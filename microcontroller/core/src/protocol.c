#include <string.h>
#include <stdio.h>
#include "utils.h"
#include "memory.h"
#include "../include/protocol.h"
#include "../include/main-thread.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"


#define PROTOCOL_LEN 1

typedef enum {
    PROTOCOL_NONE = 0x00,
    PROTOCOL_LOAD,
    PROTOCOL_JUMP,
    PROTOCOL_RESET,

    PROTOCOL_LOG,
    PROTOCOL_ERROR,
    PROTOCOL_MEMINFO,
    PROTOCOL_EXECTIME,
    PROTOCOL_PROFILE,

    // Messages between the projects in a workspace.
    PROTOCOL_SEND,
    PROTOCOL_RECEIVE,
    PROTOCOL_REPLY,
    PROTOCOL_REPLY_ERROR,
    PROTOCOL_BROADCAST,

    PROTOCOL_END
} protocol_t;


static uint32_t max_send_size(void) {
#ifdef BS_PROTOCL_USE_BLUETOOTH
    return bs_ble_max_send_size();
#else
    return UINT32_MAX;
#endif
}

// Returns 0 when the buffer is queued for sending.
static int send_buffer(uint8_t* buffer, uint32_t len) {
#ifdef BS_PROTOCL_USE_BLUETOOTH
    return bs_ble_send_buffer(buffer, len);
#else
    return 0;
#endif
}

#define SEND_RETRY_COUNT     20
#define SEND_RETRY_DELAY_MS  10

// Like send_buffer, but waits a little while the link is congested.
// Call it only from the main thread, since it blocks.
static int send_buffer_with_retry(uint8_t* buffer, uint32_t len) {
    int result = send_buffer(buffer, len);
#ifdef BS_PROTOCL_USE_BLUETOOTH
    for (int i = 0; result == BS_BLE_ERR_BUSY && i < SEND_RETRY_COUNT; i++) {
        vTaskDelay(pdMS_TO_TICKS(SEND_RETRY_DELAY_MS));
        result = send_buffer(buffer, len);
    }
#endif
    return result;
}

void bs_protocol_init(void) {
#ifdef BS_PROTOCL_USE_BLUETOOTH
    bs_ble_init();
#endif
}

void bs_protocol_write_log(char* message) {
    uint32_t len = strlen(message);
    uint32_t buffer_len = PROTOCOL_LEN + len + sizeof(uint8_t); // size of null
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_LOG;
        strcpy((char*)(buffer + PROTOCOL_LEN), message);
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.")
    }
}

void bs_protocol_write_error(char* message) {
    uint32_t len = strlen(message);
    uint32_t buffer_len = PROTOCOL_LEN + len + sizeof(uint8_t); // size of null
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_ERROR;
        strcpy((char*)(buffer + PROTOCOL_LEN), message);
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }
}

void bs_protocol_write_profile(uint8_t fid, char* profile) {
    uint32_t len = strlen(profile);
    uint32_t buffer_len = PROTOCOL_LEN + sizeof(uint8_t) + len + sizeof(uint8_t); // size of fid + len + size of null
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_PROFILE;
        buffer[1] = fid;
        strcpy((char*)(buffer + PROTOCOL_LEN + sizeof(uint8_t)), profile);
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }   
}

void bs_protocol_write_execution_time(int32_t id, float time) {
    uint32_t buffer_len = PROTOCOL_LEN + sizeof(int32_t*) + sizeof(float);
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_EXECTIME;
        *(int32_t*)(buffer+1) = id;
        *(float*)(buffer+5) = time;
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }
}

void bs_protocol_write_memory_layout(bs_memory_layout_t* layout) {
    uint32_t buffer_len = PROTOCOL_LEN + sizeof(bs_memory_layout_t);
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_MEMINFO;
        *(uint32_t*)(buffer+ 1) = (uint32_t)layout->iram_address;
        *(uint32_t*)(buffer+ 5) = layout->iram_size;
        *(uint32_t*)(buffer+ 9) = (uint32_t)layout->dram_address;
        *(uint32_t*)(buffer+13) = layout->dram_size;
        *(uint32_t*)(buffer+17) = (uint32_t)layout->iflash_address;
        *(uint32_t*)(buffer+21) = layout->iflash_size;
        *(uint32_t*)(buffer+25) = (uint32_t)layout->dflash_address;
        *(uint32_t*)(buffer+29) = layout->dflash_size;
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }
}

#define MESSAGE_MAX_NAME_LEN  255
#define MESSAGE_MAX_REASON_LEN 63   // the CLI sends ESP32 only short reasons

static uint32_t write_name(uint8_t* buffer, const char* name) {
    uint32_t len = strlen(name);
    buffer[0] = (uint8_t)len;
    memcpy(buffer + 1, name, len);
    return 1 + len;
}

// | cmd(1) | nameLen(1) | name | tagLen(1) | tag | type(1) | value(value_len) |
// The nameLen and name fields are left out when `name` is NULL.
static int write_message_request(uint8_t cmd, const char* name, const char* tag, uint8_t type,
                                 uint32_t value_len, bs_value_writer_t write_value, void* arg) {
    uint32_t name_len = name == NULL ? 0 : strlen(name);
    uint32_t tag_len = strlen(tag);
    if (name_len > MESSAGE_MAX_NAME_LEN || tag_len > MESSAGE_MAX_NAME_LEN)
        return BS_PROTOCOL_ERR_NAME_TOO_LONG;

    uint32_t buffer_len = PROTOCOL_LEN + (name == NULL ? 0 : 1 + name_len) + 1 + tag_len + 1 + value_len;
    // A request that does not fit in one packet would be dropped, and the
    // program would wait forever for a reply to it.
    if (buffer_len > max_send_size())
        return BS_PROTOCOL_ERR_TOO_LARGE;

    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer == NULL) {
        BS_LOG_ERROR("Could not get buffer.");
        return BS_PROTOCOL_ERR_NO_MEMORY;
    }
    uint32_t idx = 0;
    buffer[idx++] = cmd;
    if (name != NULL)
        idx += write_name(buffer + idx, name);
    idx += write_name(buffer + idx, tag);
    buffer[idx++] = type;
    if (value_len > 0)
        write_value(buffer + idx, arg);
    // A request that is not sent would never be answered, so the caller must not wait for it.
    int result = send_buffer_with_retry(buffer, buffer_len);
    free(buffer);
    return result == 0 ? 0 : BS_PROTOCOL_ERR_SEND_FAILED;
}

int bs_protocol_write_send(const char* dst, const char* tag, uint8_t type,
                           uint32_t value_len, bs_value_writer_t write_value, void* arg) {
    return write_message_request(PROTOCOL_SEND, dst, tag, type, value_len, write_value, arg);
}

int bs_protocol_write_broadcast(const char* tag, uint8_t type,
                                uint32_t value_len, bs_value_writer_t write_value, void* arg) {
    return write_message_request(PROTOCOL_BROADCAST, NULL, tag, type, value_len, write_value, arg);
}

int bs_protocol_write_receive(const char* src, const char* tag, uint8_t type) {
    return write_message_request(PROTOCOL_RECEIVE, src, tag, type, 0, NULL, NULL);
}

// The number of bytes the `count` elements of an any[] take, or UINT32_MAX when they are
// malformed or longer than `len` bytes. Each is | type(1) | value |.
static uint32_t any_array_size(const uint8_t* elements, uint32_t len, uint16_t count) {
    uint32_t size = 0;
    for (uint16_t i = 0; i < count; i++) {
        if (size + 1 > len) return UINT32_MAX;
        uint8_t type = elements[size++];
        uint32_t value_size;
        switch (type) {
            case BS_MSG_INTEGER:
            case BS_MSG_FLOAT:   value_size = 4; break;
            case BS_MSG_BOOLEAN: value_size = 1; break;
            case BS_MSG_NULL:    value_size = 0; break;
            case BS_MSG_STRING: {
                if (size + 2 > len) return UINT32_MAX;
                uint16_t n;
                memcpy(&n, elements + size, 2);
                value_size = 2 + n;
                break;
            }
            default:
                return UINT32_MAX;
        }
        size += value_size;
        if (size > len) return UINT32_MAX;
    }
    return size;
}

// Reads the value of a Reply at `value` (after the type byte) into `reply`, and
// returns its length, or -1 when it is malformed or longer than `len` bytes.
// Fixed-size values are kept in `reply`; the bytes of variable-size values are
// copied to a malloc'd buffer, since `buffer` is reused once this returns.
static int32_t read_reply_value(uint8_t type, const uint8_t* value, uint32_t len,
                                bs_message_reply_t* reply, const char** error) {
    uint32_t elem_size;
    switch (type) {
        case BS_MSG_INTEGER:
        case BS_MSG_FLOAT:
            if (len < 4) return -1;
            memcpy(&reply->scalar, value, 4);
            return 4;
        case BS_MSG_BOOLEAN:
            if (len < 1) return -1;
            reply->scalar.i = value[0];
            return 1;
        case BS_MSG_NULL:
            return 0;
        case BS_MSG_STRING:
        case BS_MSG_BOOLEAN_ARRAY:
            elem_size = 1;
            break;
        case BS_MSG_INTEGER_ARRAY:
        case BS_MSG_FLOAT_ARRAY:
            elem_size = 4;
            break;
        case BS_MSG_ANY_ARRAY:
            elem_size = 0;      // each element has its own size
            break;
        default:
            return -1;
    }
    if (len < 2) return -1;
    uint16_t count;
    memcpy(&count, value, 2);
    uint32_t size = elem_size > 0 ? count * elem_size : any_array_size(value + 2, len - 2, count);
    if (size == UINT32_MAX || len < 2 + size) return -1;
    reply->count = count;
    reply->size = (uint16_t)size;
    reply->data = (uint8_t*)malloc(size > 0 ? size : 1);
    if (reply->data == NULL)
        *error = "out of memory";
    else
        memcpy(reply->data, value + 2, size);
    return 2 + size;
}

void bs_protocol_read(uint8_t* buffer, uint32_t len) {
    int idx = 0;
    while (idx < len) {
        switch (buffer[idx]) {
        case PROTOCOL_LOAD:
        // | cmd(1byte) | address(4byte) | size(4byte) | data(size) |
        {
            // uint32_t address = *(uint32_t*)(buffer + (idx+1));
            void* address = *(void**)(buffer + (idx+1)); 
            uint32_t size = *(uint32_t*)(buffer + (idx+5));
            BS_LOG_INFO("Load %d bytes to %p", (int)size, address);
            bs_memory_memcpy(address, buffer + (idx+9), size);
            idx += (9 + size);
            break;
        }
        case PROTOCOL_JUMP:
        // | cmd(1byte) | id(4byte) | address(4byte) |
        {
            int32_t id = *(int32_t*)(buffer + (idx+1));
            void* address = *(void**)(buffer + (idx+5));
            bs_main_thread_set_main(id, address);
            idx += 9;
            break;
        }
        case PROTOCOL_RESET:
        // | cmd (1byte) | 
        {
            bs_main_thread_reset();
            idx += 1;
            break;
        }
        case PROTOCOL_REPLY:
        // | cmd(1byte) | type(1byte) | value |
        {
            bs_message_reply_t reply = { .type = buffer[idx+1] };
            const char* error = NULL;
            int32_t value_len = idx + 2 <= len
                ? read_reply_value(reply.type, buffer + (idx+2), len - (idx+2), &reply, &error)
                : -1;
            if (value_len < 0) {
                // The rest of the buffer cannot be parsed either.
                bs_main_thread_set_reply_error("bad reply");
                return;
            }
            if (error != NULL)
                bs_main_thread_set_reply_error(error);
            else
                bs_main_thread_set_reply(&reply);
            idx += 2 + value_len;
            break;
        }
        case PROTOCOL_REPLY_ERROR:
        // | cmd(1byte) | len(1byte) | reason(len) |
        {
            uint8_t reason_len = buffer[idx+1];
            uint8_t copy_len = reason_len < MESSAGE_MAX_REASON_LEN ? reason_len : MESSAGE_MAX_REASON_LEN;
            char reason[MESSAGE_MAX_REASON_LEN + 1];
            memcpy(reason, buffer + (idx+2), copy_len);
            reason[copy_len] = '\0';
            bs_main_thread_set_reply_error(reason);
            idx += 2 + reason_len;
            break;
        }
        case PROTOCOL_END:
        // | cmd(1byte) |
            return;
        default:
            return;
        }
    }
}