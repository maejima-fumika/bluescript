#ifndef __BS_MAIN_THREAD__
#define __BS_MAIN_THREAD__

#include <stdint.h>
#include "c-runtime.h"

#define CORE_TEXT_SECTION __attribute__((section(".core_text")))

void CORE_TEXT_SECTION bs_main_thread_init();

void CORE_TEXT_SECTION bs_main_thread_reset();

void CORE_TEXT_SECTION bs_main_thread_set_main(int32_t id, void* address);

void CORE_TEXT_SECTION bs_main_thread_set_event(value_t fn);

void CORE_TEXT_SECTION bs_main_thread_set_event_from_isr(void* fn);

void CORE_TEXT_SECTION bs_main_thread_set_profile(uint8_t fid, char* profile);

// The CLI's reply to a send, broadcast or receive request (see BS_MSG_* in protocol.h).
typedef struct {
    uint8_t type;
    union { int32_t i; float f; } scalar;   // integer, float and boolean values
    uint16_t count;                         // string and array values: the number of elements,
    uint16_t size;                          // ... the number of bytes in `data`,
    uint8_t* data;                          // ... and their bytes (malloc'd; the receiver frees it)
} bs_message_reply_t;

// Hands a reply to the main thread; `reply` is copied, but `reply->data` is handed over.
void CORE_TEXT_SECTION bs_main_thread_set_reply(const bs_message_reply_t* reply);

// Hands an error reply to the main thread; `error` is copied.
void CORE_TEXT_SECTION bs_main_thread_set_reply_error(const char* error);

// Blocks the main thread until the reply arrives. Returns 0 and fills `reply`,
// or returns -1 and copies the reason into `error`.
int CORE_TEXT_SECTION bs_main_thread_wait_reply(bs_message_reply_t* reply, char* error, int error_size);

#endif /* __BS_MAIN_THREAD__ */