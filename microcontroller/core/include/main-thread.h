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

// Hands the CLI's reply to a send/receive request to the main thread.
// `error` is NULL on success; otherwise it is copied.
void CORE_TEXT_SECTION bs_main_thread_set_reply(int32_t value, const char* error);

// Blocks the main thread until the reply arrives. Returns 0 and sets `value`,
// or returns -1 and copies the reason into `error`.
int CORE_TEXT_SECTION bs_main_thread_wait_reply(int32_t* value, char* error, int error_size);

#endif /* __BS_MAIN_THREAD__ */