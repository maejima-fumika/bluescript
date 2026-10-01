#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "./comm.h"


static void comm_send(host_protocol_t protocol, char* payload) {
    char line[MAX_LINE_SIZE];
    snprintf(line, PROTO_SIZE, "%02d", protocol);
    line[PROTO_SIZE - 1] = ' ';
    snprintf((char*)(line + PROTO_SIZE), PAYLOAD_LEN_SIZE, "%04d", (int)strlen(payload));
    line[HEADER_SIZE - 1] = ' ';
    strcpy((char*)(line + HEADER_SIZE), payload);
    fprintf(stdout, "%s", line);
    fflush(stdout);
}

void bs_comm_send_log(char* message) {
    comm_send(H_PROTOCOL_LOG, message);
}

void bs_comm_send_error(char* message) {
    comm_send(H_PROTOCOL_ERROR, message);
}

void bs_comm_send_exectime(float time) {
    char timestr[16];
    snprintf(timestr, sizeof(timestr), "%.4f", time);
    comm_send(H_PROTOCOL_EXECTIME, timestr);
}

void bs_comm_send_loadtime(float time) {
    char timestr[16];
    snprintf(timestr, sizeof(timestr), "%.2f", time);
    comm_send(H_PROTOCOL_LOADTIME, timestr);
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
    for (int i = 0; i < payload_len; i++) {
        if (line[HEADER_SIZE + i] == 0x0a || line[HEADER_SIZE + i] == 0x0d)
            payload[i] = '\0';
        else
            payload[i] = line[HEADER_SIZE + i];
    }
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
#define INTEGER_TYPE     'i'

static int check_name(const char* name, char* error, int error_size) {
    if (strlen(name) > MAX_NAME_LEN) {
        snprintf(error, error_size, "the name or tag is longer than %d bytes: %s", MAX_NAME_LEN, name);
        return -1;
    }
    return 0;
}

// Waits for the reply to a Send or Receive request. The program is running,
// so the shell's main loop is not reading stdin meanwhile.
static int wait_reply(int32_t* value, char* error, int error_size) {
    char line[MAX_LINE_SIZE] = {0};
    if (getoneline(line, MAX_LINE_SIZE) == NULL) {
        snprintf(error, error_size, "the connection to the CLI was closed");
        return -1;
    }

    host_protocol_t protocol;
    char payload[MAX_PAYLOAD_SIZE + 1] = {0};
    parse_line(line, &protocol, payload);

    switch (protocol) {
        case H_PROTOCOL_REPLY:
            if (payload[0] != INTEGER_TYPE) {
                snprintf(error, error_size, "unexpected reply: %s", payload);
                return -1;
            }
            if (value != NULL)
                *value = (int32_t)strtol(payload + 1, NULL, 10);
            return 0;
        case H_PROTOCOL_REPLY_ERROR:
            snprintf(error, error_size, "%s", payload);
            return -1;
        default:
            snprintf(error, error_size, "unexpected protocol %d while waiting for a message", protocol);
            return -1;
    }
}

int bs_comm_send_integer(const char* dst, const char* tag, int32_t value, char* error, int error_size) {
    if (check_name(dst, error, error_size) < 0 || check_name(tag, error, error_size) < 0)
        return -1;

    char payload[MAX_PAYLOAD_SIZE + 1];
    int len = snprintf(payload, sizeof(payload), "%0*d%s%0*d%s%c%d",
                       NAME_LEN_DIGITS, (int)strlen(dst), dst,
                       NAME_LEN_DIGITS, (int)strlen(tag), tag,
                       INTEGER_TYPE, (int)value);
    if (len < 0 || len >= MAX_PAYLOAD_SIZE) {
        snprintf(error, error_size, "the message to %s is too long", dst);
        return -1;
    }
    comm_send(H_PROTOCOL_SEND, payload);
    return wait_reply(NULL, error, error_size);
}

int bs_comm_receive_integer(const char* src, const char* tag, int32_t* value, char* error, int error_size) {
    if (check_name(src, error, error_size) < 0 || check_name(tag, error, error_size) < 0)
        return -1;

    char payload[MAX_PAYLOAD_SIZE + 1];
    int len = snprintf(payload, sizeof(payload), "%0*d%s%0*d%s%c",
                       NAME_LEN_DIGITS, (int)strlen(src), src,
                       NAME_LEN_DIGITS, (int)strlen(tag), tag,
                       INTEGER_TYPE);
    if (len < 0 || len >= MAX_PAYLOAD_SIZE) {
        snprintf(error, error_size, "the request to %s is too long", src);
        return -1;
    }
    comm_send(H_PROTOCOL_RECEIVE, payload);
    return wait_reply(value, error, error_size);
}

char* bs_comm_wait_receive(void (*on_load)(char* filename), void (*on_call)(char* funcname)) {
    char line[MAX_LINE_SIZE] = {0};
    char* res = getoneline(line, MAX_LINE_SIZE);
    if (res == NULL)
        return NULL;

    host_protocol_t protocol;
    char payload[MAX_PAYLOAD_SIZE] = {0};
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



