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

int CORE_TEXT_SECTION bs_protocol_write_send(const char* dst, const char* tag, int32_t value);

int CORE_TEXT_SECTION bs_protocol_write_receive(const char* src, const char* tag);

void CORE_TEXT_SECTION bs_protocol_read(uint8_t* buffer, uint32_t len);

#endif /* __BS_PROTOCOL__ */