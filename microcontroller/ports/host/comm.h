#ifndef __BS_HOST_COMM__
#define __BS_HOST_COMM__

#include <stdint.h>

// Must match HOST_MAX_PAYLOAD_SIZE in cli/src/services/protocol/host-protocol.ts.
#define MAX_PAYLOAD_SIZE 4096
#define PROTO_SIZE       3
#define PAYLOAD_LEN_SIZE 5
#define HEADER_SIZE      (PROTO_SIZE + PAYLOAD_LEN_SIZE)
// A line from the CLI ends with '\n', and fgets adds '\0'.
#define MAX_LINE_SIZE    (HEADER_SIZE + MAX_PAYLOAD_SIZE + 2)

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
    H_PROTOCOL_BROADCAST = 11,

    H_PROTOCOL_MAX
} host_protocol_t;

void bs_comm_send_log(char* message);
void bs_comm_send_error(char* message);
void bs_comm_send_exectime(float time);
void bs_comm_send_loadtime(float time);
// The type chars of a message value: <type char><text>, as in host-protocol.ts (formatHostValue).
#define MSG_TYPE_INTEGER        'i'
#define MSG_TYPE_FLOAT          'f'
#define MSG_TYPE_BOOLEAN        'b'
#define MSG_TYPE_STRING         's'
#define MSG_TYPE_NULL           'n'
#define MSG_TYPE_INTEGER_ARRAY  'I'
#define MSG_TYPE_FLOAT_ARRAY    'F'
#define MSG_TYPE_BOOLEAN_ARRAY  'B'
#define MSG_TYPE_ANY_ARRAY      'A'   // comma-separated values with their type chars

// Messages between the projects in a workspace. `value` is <type char><text>.
// All block until the CLI replies, and return 0 on success, or -1 with the reason in `error`.
int bs_comm_send_message(const char* dst, const char* tag, const char* value, char* error, int error_size);
int bs_comm_broadcast_message(const char* tag, const char* value, char* error, int error_size);
// Asks for a value of type `type` and writes its text (without the type char) to `value`,
// which must hold MAX_PAYLOAD_SIZE + 1 bytes.
int bs_comm_receive_message(const char* src, const char* tag, char type, char* value, char* error, int error_size);
char* bs_comm_wait_receive(void (*on_load)(char* filename), void (*on_call)(char* funcname));


#endif /* __BS_HOST_COMM__ */