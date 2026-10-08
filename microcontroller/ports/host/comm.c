#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <inttypes.h>
#include "./comm.h"


static void comm_send(host_protocol_t protocol, const char* payload) {
    char line[MAX_LINE_SIZE];
    size_t len = strlen(payload);
    if (len > MAX_PAYLOAD_SIZE)
        len = MAX_PAYLOAD_SIZE;     // a longer log line is cut rather than overflowing `line`
    snprintf(line, PROTO_SIZE, "%02d", protocol);
    line[PROTO_SIZE - 1] = ' ';
    snprintf((char*)(line + PROTO_SIZE), PAYLOAD_LEN_SIZE, "%04d", (int)len);
    line[HEADER_SIZE - 1] = ' ';
    memcpy((char*)(line + HEADER_SIZE), payload, len);
    line[HEADER_SIZE + len] = '\0';
    fprintf(stdout, "%s", line);
    fflush(stdout);
}

void bs_comm_send_log(char* message) {
    comm_send(H_PROTOCOL_LOG, message);
}

void bs_comm_send_error(char* message) {
    comm_send(H_PROTOCOL_ERROR, message);
}

// "<time> <error>"
void bs_comm_send_exectime(float time, int error) {
    char payload[32];
    snprintf(payload, sizeof(payload), "%.4f %d", time, error ? 1 : 0);
    comm_send(H_PROTOCOL_EXECTIME, payload);
}

void bs_comm_send_loadtime(float time) {
    char timestr[16];
    snprintf(timestr, sizeof(timestr), "%.2f", time);
    comm_send(H_PROTOCOL_LOADTIME, timestr);
}

// "<runs> <gc_ms> <alloc_words> <alloc_objects> <heap_words>"
void bs_comm_send_gcstats(uint32_t runs, double gc_ms, uint64_t alloc_words, uint32_t alloc_objects, uint32_t heap_words) {
    char payload[128];
    snprintf(payload, sizeof(payload), "%" PRIu32 " %.4f %" PRIu64 " %" PRIu32 " %" PRIu32,
             runs, gc_ms, alloc_words, alloc_objects, heap_words);
    comm_send(H_PROTOCOL_GCSTATS, payload);
}

static void parse_line(char* line, host_protocol_t* protocol, char* payload) {
    char protocol_char[PROTO_SIZE];
    protocol_char[0] = line[0];
    protocol_char[1] = line[1];
    protocol_char[2] = '\0';
    char payload_len_char[PAYLOAD_LEN_SIZE];
    payload_len_char[0] = line[PROTO_SIZE + 0];
    payload_len_char[1] = line[PROTO_SIZE + 1];
    payload_len_char[2] = line[PROTO_SIZE + 2];
    payload_len_char[3] = line[PROTO_SIZE + 3];
    payload_len_char[4] = '\0';
    *protocol = atoi(protocol_char);
    int payload_len = atoi(payload_len_char);
    if (payload_len > MAX_PAYLOAD_SIZE)
        payload_len = MAX_PAYLOAD_SIZE;     // `payload` holds MAX_PAYLOAD_SIZE + 1 bytes
    for (int i = 0; i < payload_len; i++) {
        if (line[HEADER_SIZE + i] == 0x0a || line[HEADER_SIZE + i] == 0x0d)
            payload[i] = '\0';
        else
            payload[i] = line[HEADER_SIZE + i];
    }
    payload[payload_len] = '\0';
}

static char* getoneline(char* buffer, int size) {
    char* res;
    if ((res = fgets(buffer, size, stdin)) == NULL) {
        buffer[0] = '\0';
        return NULL;
    }
    else {
        for (int i = 0; i < size; i++)
            if (buffer[i] == 0x0a || buffer[i] == 0x0d)
                buffer[i] = '\0';
        return res;
    }
}

#define NAME_LEN_DIGITS  3
#define MAX_NAME_LEN     255

static int check_name(const char* name, char* error, int error_size) {
    if (strlen(name) > MAX_NAME_LEN) {
        snprintf(error, error_size, "the name or tag is longer than %d bytes: %s", MAX_NAME_LEN, name);
        return -1;
    }
    return 0;
}

// Waits for the reply to a Send, Broadcast or Receive request, which carries a value
// of type `type` (null for the acknowledgement of a send). The program is running,
// so the shell's main loop is not reading stdin meanwhile.
static int wait_reply(char type, char* value, char* error, int error_size) {
    static char line[MAX_LINE_SIZE];
    if (getoneline(line, MAX_LINE_SIZE) == NULL) {
        snprintf(error, error_size, "the connection to the CLI was closed");
        return -1;
    }

    host_protocol_t protocol;
    static char payload[MAX_PAYLOAD_SIZE + 1];
    memset(payload, 0, sizeof(payload));
    parse_line(line, &protocol, payload);

    switch (protocol) {
        case H_PROTOCOL_REPLY:
            if (payload[0] != type) {
                snprintf(error, error_size, "unexpected reply: %.64s", payload);
                return -1;
            }
            if (value != NULL)
                strcpy(value, payload + 1);
            return 0;
        case H_PROTOCOL_REPLY_ERROR:
            snprintf(error, error_size, "%s", payload);
            return -1;
        default:
            snprintf(error, error_size, "unexpected protocol %d while waiting for a message", protocol);
            return -1;
    }
}

// Writes <len(3)><name> for each of `names` and then `rest`, and sends it as `protocol`.
static int send_request(host_protocol_t protocol, const char* names[], int n_names, const char* rest,
                        char* error, int error_size) {
    static char payload[MAX_PAYLOAD_SIZE + 1];
    int len = 0;
    for (int i = 0; i < n_names; i++) {
        if (check_name(names[i], error, error_size) < 0)
            return -1;
        len += snprintf(payload + len, sizeof(payload) - len, "%0*d%s",
                        NAME_LEN_DIGITS, (int)strlen(names[i]), names[i]);
        if (len >= MAX_PAYLOAD_SIZE)
            break;
    }
    if (len < MAX_PAYLOAD_SIZE)
        len += snprintf(payload + len, sizeof(payload) - len, "%s", rest);
    if (len >= MAX_PAYLOAD_SIZE) {
        snprintf(error, error_size, "the message is longer than %d bytes", MAX_PAYLOAD_SIZE);
        return -1;
    }
    comm_send(protocol, payload);
    return 0;
}

int bs_comm_send_message(const char* dst, const char* tag, const char* value, char* error, int error_size) {
    const char* names[] = { dst, tag };
    if (send_request(H_PROTOCOL_SEND, names, 2, value, error, error_size) < 0)
        return -1;
    return wait_reply(MSG_TYPE_NULL, NULL, error, error_size);
}

int bs_comm_broadcast_message(const char* tag, const char* value, char* error, int error_size) {
    const char* names[] = { tag };
    if (send_request(H_PROTOCOL_BROADCAST, names, 1, value, error, error_size) < 0)
        return -1;
    return wait_reply(MSG_TYPE_NULL, NULL, error, error_size);
}

int bs_comm_receive_message(const char* src, const char* tag, char type, char* value, char* error, int error_size) {
    const char* names[] = { src, tag };
    char type_str[2] = { type, '\0' };
    if (send_request(H_PROTOCOL_RECEIVE, names, 2, type_str, error, error_size) < 0)
        return -1;
    return wait_reply(type, value, error, error_size);
}

char* bs_comm_wait_receive(void (*on_load)(char* filename), void (*on_call)(char* funcname)) {
    char line[MAX_LINE_SIZE] = {0};
    char* res = getoneline(line, MAX_LINE_SIZE);
    if (res == NULL)
        return NULL;

    host_protocol_t protocol;
    char payload[MAX_PAYLOAD_SIZE + 1] = {0};
    parse_line(line, &protocol, payload);

    switch (protocol) {
        case H_PROTOCOL_LOAD:
            on_load(payload);
            break;
        case H_PROTOCOL_CALL:
            on_call(payload);
            break;
        default:
            fprintf(stderr, "Error: unknown protocol\n");
            break;
    }
    return res;
}



