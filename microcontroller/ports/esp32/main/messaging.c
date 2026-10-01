#include <stdlib.h>
#include <string.h>
#include "protocol.h"
#include "main-thread.h"
#include "include/messaging.h"

// A value has a fixed size (integer, float, boolean, null) or a variable size
// (string, arrays: count + elements). Each group has one send and one receive path.

#define MAX_COUNT        0xffff
// A reply fits in one BLE write, so its elements never take more than this.
#define MAX_REPLY_BYTES  512

static char messaging_error[64];

static void check_request(int result) {
    if (result == BS_PROTOCOL_ERR_NAME_TOO_LONG)
        runtime_error("name too long");
    else if (result == BS_PROTOCOL_ERR_TOO_LARGE)
        runtime_error("request too long");
    else if (result == BS_PROTOCOL_ERR_NO_MEMORY)
        runtime_error("out of memory");
    else if (result == BS_PROTOCOL_ERR_SEND_FAILED)
        runtime_error("send failed");
}

static bs_message_reply_t wait_reply(void) {
    bs_message_reply_t reply;
    if (bs_main_thread_wait_reply(&reply, messaging_error, sizeof(messaging_error)) < 0)
        runtime_error(messaging_error);
    return reply;
}

// ---- Sending ----

// The bytes of a value to send: | count(2), if has_count | bytes(size) |
typedef struct {
    bool has_count;
    uint16_t count;
    const void* bytes;
    uint32_t size;
} value_source_t;

static void write_source(uint8_t* out, void* arg) {
    value_source_t* source = (value_source_t*)arg;
    if (source->has_count) {
        memcpy(out, &source->count, sizeof(uint16_t));
        out += sizeof(uint16_t);
    }
    if (source->size > 0)
        memcpy(out, source->bytes, source->size);
}

// Sends to `dst`, or to every other project when `dst` is NULL, and waits for the acknowledgement.
static void send_value(const char* dst, value_t tag, uint8_t type, value_source_t* source) {
    uint32_t len = (source->has_count ? sizeof(uint16_t) : 0) + source->size;
    const char* tag_str = gc_string_to_cstr(tag);
    int result = dst == NULL
        ? bs_protocol_write_broadcast(tag_str, type, len, write_source, source)
        : bs_protocol_write_send(dst, tag_str, type, len, write_source, source);
    check_request(result);
    bs_message_reply_t ack = wait_reply();
    free(ack.data);     // NULL, since the acknowledgement carries null
}

static void send_fixed(const char* dst, value_t tag, uint8_t type, const void* bytes, uint32_t size) {
    value_source_t source = { false, 0, bytes, size };
    send_value(dst, tag, type, &source);
}

static void send_variable(const char* dst, value_t tag, uint8_t type,
                          int32_t count, const void* elements, uint32_t elem_size) {
    if (count > MAX_COUNT)
        runtime_error("request too long");
    value_source_t source = { true, (uint16_t)count, elements, (uint32_t)count * elem_size };
    send_value(dst, tag, type, &source);
}

static void send_integer_to(const char* dst, value_t tag, int32_t value) {
    send_fixed(dst, tag, BS_MSG_INTEGER, &value, sizeof(int32_t));
}

static void send_float_to(const char* dst, value_t tag, float value) {
    send_fixed(dst, tag, BS_MSG_FLOAT, &value, sizeof(float));
}

static void send_boolean_to(const char* dst, value_t tag, int32_t value) {
    uint8_t b = value != 0;
    send_fixed(dst, tag, BS_MSG_BOOLEAN, &b, 1);
}

static void send_string_to(const char* dst, value_t tag, value_t value) {
    const char* str = gc_string_to_cstr(value);
    send_variable(dst, tag, BS_MSG_STRING, strlen(str), str, 1);
}

static void send_integer_array_to(const char* dst, value_t tag, value_t value) {
    int32_t n = gc_intarray_length(value);
    // *_get checks the index, so do not call it for an empty array.
    send_variable(dst, tag, BS_MSG_INTEGER_ARRAY, n, n > 0 ? gc_intarray_get(value, 0) : NULL, sizeof(int32_t));
}

static void send_float_array_to(const char* dst, value_t tag, value_t value) {
    int32_t n = gc_floatarray_length(value);
    send_variable(dst, tag, BS_MSG_FLOAT_ARRAY, n, n > 0 ? gc_floatarray_get(value, 0) : NULL, sizeof(float));
}

static void send_boolean_array_to(const char* dst, value_t tag, value_t value) {
    int32_t n = gc_bytearray_length(value);
    send_variable(dst, tag, BS_MSG_BOOLEAN_ARRAY, n, n > 0 ? gc_bytearray_get(value, 0) : NULL, 1);
}

#define DEFINE_SEND(name, ctype) \
    void bs_messaging_send_##name(value_t dst, value_t tag, ctype value) { \
        send_##name##_to(gc_string_to_cstr(dst), tag, value); \
    } \
    void bs_messaging_broadcast_##name(value_t tag, ctype value) { \
        send_##name##_to(NULL, tag, value); \
    }

DEFINE_SEND(integer, int32_t)
DEFINE_SEND(float, float)
DEFINE_SEND(boolean, int32_t)
DEFINE_SEND(string, value_t)
DEFINE_SEND(integer_array, value_t)
DEFINE_SEND(float_array, value_t)
DEFINE_SEND(boolean_array, value_t)

void bs_messaging_send_null(value_t dst, value_t tag) {
    send_fixed(gc_string_to_cstr(dst), tag, BS_MSG_NULL, NULL, 0);
}

void bs_messaging_broadcast_null(value_t tag) {
    send_fixed(NULL, tag, BS_MSG_NULL, NULL, 0);
}

// ---- Receiving ----

static bs_message_reply_t receive_value(value_t src, value_t tag, uint8_t type) {
    check_request(bs_protocol_write_receive(gc_string_to_cstr(src), gc_string_to_cstr(tag), type));
    bs_message_reply_t reply = wait_reply();
    if (reply.type != type) {
        free(reply.data);
        runtime_error("bad reply");
    }
    return reply;
}

// Moves the elements of a variable-size reply to `out` and returns their number.
// The malloc'd bytes are freed before any GC object is made, so a runtime error
// while making it does not leak them.
static uint16_t take_elements(bs_message_reply_t* reply, uint8_t* out, uint32_t elem_size) {
    uint32_t size = reply->count * elem_size;
    if (size > MAX_REPLY_BYTES) {
        free(reply->data);
        runtime_error("bad reply");
    }
    memcpy(out, reply->data, size);
    free(reply->data);
    return reply->count;
}

int32_t bs_messaging_receive_integer(value_t src, value_t tag) {
    return receive_value(src, tag, BS_MSG_INTEGER).scalar.i;
}

float bs_messaging_receive_float(value_t src, value_t tag) {
    return receive_value(src, tag, BS_MSG_FLOAT).scalar.f;
}

int32_t bs_messaging_receive_boolean(value_t src, value_t tag) {
    return receive_value(src, tag, BS_MSG_BOOLEAN).scalar.i != 0;
}

void bs_messaging_receive_null(value_t src, value_t tag) {
    receive_value(src, tag, BS_MSG_NULL);
}

value_t bs_messaging_receive_string(value_t src, value_t tag) {
    uint8_t bytes[MAX_REPLY_BYTES];
    bs_message_reply_t reply = receive_value(src, tag, BS_MSG_STRING);
    uint16_t n = take_elements(&reply, bytes, 1);
    return gc_new_string_copy((const char*)bytes, n);
}

value_t bs_messaging_receive_integer_array(value_t src, value_t tag) {
    uint8_t bytes[MAX_REPLY_BYTES];
    bs_message_reply_t reply = receive_value(src, tag, BS_MSG_INTEGER_ARRAY);
    uint16_t n = take_elements(&reply, bytes, sizeof(int32_t));
    value_t array = gc_new_intarray(n, 0);
    if (n > 0)
        memcpy(gc_intarray_get(array, 0), bytes, n * sizeof(int32_t));
    return array;
}

value_t bs_messaging_receive_float_array(value_t src, value_t tag) {
    uint8_t bytes[MAX_REPLY_BYTES];
    bs_message_reply_t reply = receive_value(src, tag, BS_MSG_FLOAT_ARRAY);
    uint16_t n = take_elements(&reply, bytes, sizeof(float));
    value_t array = gc_new_floatarray(n, 0.0f);
    if (n > 0)
        memcpy(gc_floatarray_get(array, 0), bytes, n * sizeof(float));
    return array;
}

value_t bs_messaging_receive_boolean_array(value_t src, value_t tag) {
    uint8_t bytes[MAX_REPLY_BYTES];
    bs_message_reply_t reply = receive_value(src, tag, BS_MSG_BOOLEAN_ARRAY);
    uint16_t n = take_elements(&reply, bytes, 1);
    value_t array = gc_new_bytearray(true, n, 0);
    if (n > 0)
        memcpy(gc_bytearray_get(array, 0), bytes, n);
    return array;
}
