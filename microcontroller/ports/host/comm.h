#ifndef __BS_HOST_COMM__
#define __BS_HOST_COMM__

#include <stdint.h>

#define MAX_PAYLOAD_SIZE 256
#define PROTO_SIZE       3
#define PAYLOAD_LEN_SIZE 5
#define HEADER_SIZE      PROTO_SIZE + PAYLOAD_LEN_SIZE
#define MAX_LINE_SIZE    HEADER_SIZE + MAX_PAYLOAD_SIZE

typedef enum {
    H_PROTOCOL_NONE = 0,
    H_PROTOCOL_LOAD = 1,
    H_PROTOCOL_CALL = 2,

    H_PROTOCOL_LOG = 3,
    H_PROTOCOL_ERROR = 4,
    H_PROTOCOL_EXECTIME = 5,
    H_PROTOCOL_LOADTIME = 6,

    // Messages between the projects in a workspace.
    H_PROTOCOL_SEND = 7,
    H_PROTOCOL_RECEIVE = 8,
    H_PROTOCOL_REPLY = 9,
    H_PROTOCOL_REPLY_ERROR = 10,

    H_PROTOCOL_MAX
} host_protocol_t;

void bs_comm_send_log(char* message);
void bs_comm_send_error(char* message);
void bs_comm_send_exectime(float time);
void bs_comm_send_loadtime(float time);
// Both block until the CLI replies. They return 0 on success, or -1 with the reason in `error`.
int bs_comm_send_integer(const char* dst, const char* tag, int32_t value, char* error, int error_size);
int bs_comm_receive_integer(const char* src, const char* tag, int32_t* value, char* error, int error_size);
char* bs_comm_wait_receive(void (*on_load)(char* filename), void (*on_call)(char* funcname));


#endif /* __BS_HOST_COMM__ */