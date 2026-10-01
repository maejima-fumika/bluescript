#ifndef __BS_PROTOCOL__
#define __BS_PROTOCOL__
#include <stdint.h>
#include "memory.h"
#include "ble.h"
#define CORE_TEXT_SECTION __attribute__((section(".core_text")))
#define BS_PROTOCL_USE_BLUETOOTH


void CORE_TEXT_SECTION bs_protocol_init(void);

void CORE_TEXT_SECTION bs_protocol_write_log(char* message);

void CORE_TEXT_SECTION bs_protocol_write_error(char* message);

void CORE_TEXT_SECTION bs_protocol_write_profile(uint8_t fid, char* profile);

void CORE_TEXT_SECTION bs_protocol_write_execution_time(int32_t id, float time);

void CORE_TEXT_SECTION bs_protocol_write_memory_layout(bs_memory_layout_t* layout);

// Messages between the projects in a workspace. Both only send the request;
// the CLI's reply arrives through bs_protocol_read (see bs_main_thread_wait_reply).
// They return 0, or one of the BS_PROTOCOL_ERR_* codes when the request was not sent.
#define BS_PROTOCOL_ERR_NAME_TOO_LONG  (-1)  // a name or tag is longer than 255 bytes
#define BS_PROTOCOL_ERR_TOO_LARGE      (-2)  // the request does not fit in one BLE packet (MTU)
#define BS_PROTOCOL_ERR_NO_MEMORY      (-3)  // no buffer for the request
#define BS_PROTOCOL_ERR_SEND_FAILED    (-4)  // the request could not be sent over BLE

// Type codes of message values. Must match MessageValueType in cli/src/services/protocol/device-protocol.ts.
#define BS_MSG_INTEGER        0   // int32
#define BS_MSG_FLOAT          1   // float32
#define BS_MSG_BOOLEAN        2   // u8
#define BS_MSG_STRING         3   // count(2) + bytes
#define BS_MSG_NULL           4   // nothing
#define BS_MSG_INTEGER_ARRAY  5   // count(2) + int32 x count
#define BS_MSG_FLOAT_ARRAY    6   // count(2) + float32 x count
#define BS_MSG_BOOLEAN_ARRAY  7   // count(2) + u8 x count

// Writes the `value_len` bytes of a value (the part after the type byte) to `out`.
typedef void (*bs_value_writer_t)(uint8_t* out, void* arg);

int CORE_TEXT_SECTION bs_protocol_write_send(const char* dst, const char* tag, uint8_t type,
                                             uint32_t value_len, bs_value_writer_t write_value, void* arg);

int CORE_TEXT_SECTION bs_protocol_write_broadcast(const char* tag, uint8_t type,
                                                  uint32_t value_len, bs_value_writer_t write_value, void* arg);

// `type` is the type the program expects.
int CORE_TEXT_SECTION bs_protocol_write_receive(const char* src, const char* tag, uint8_t type);

void CORE_TEXT_SECTION bs_protocol_read(uint8_t* buffer, uint32_t len);

#endif /* __BS_PROTOCOL__ */