#ifndef __BS_MESSAGING__
#define __BS_MESSAGING__

#include <stdint.h>
#include "c-runtime.h"

// Messages between the projects in a workspace (see bscript workspace run).
// The built-ins in std-module.bs call these. `dst`, `src` and `tag` are strings.
// Errors raise a runtime error with a short message, to save memory.

void bs_messaging_send_integer(value_t dst, value_t tag, int32_t value);
void bs_messaging_send_float(value_t dst, value_t tag, float value);
void bs_messaging_send_boolean(value_t dst, value_t tag, int32_t value);
void bs_messaging_send_string(value_t dst, value_t tag, value_t value);
void bs_messaging_send_null(value_t dst, value_t tag);
void bs_messaging_send_integer_array(value_t dst, value_t tag, value_t value);
void bs_messaging_send_float_array(value_t dst, value_t tag, value_t value);
void bs_messaging_send_boolean_array(value_t dst, value_t tag, value_t value);

void bs_messaging_broadcast_integer(value_t tag, int32_t value);
void bs_messaging_broadcast_float(value_t tag, float value);
void bs_messaging_broadcast_boolean(value_t tag, int32_t value);
void bs_messaging_broadcast_string(value_t tag, value_t value);
void bs_messaging_broadcast_null(value_t tag);
void bs_messaging_broadcast_integer_array(value_t tag, value_t value);
void bs_messaging_broadcast_float_array(value_t tag, value_t value);
void bs_messaging_broadcast_boolean_array(value_t tag, value_t value);

int32_t bs_messaging_receive_integer(value_t src, value_t tag);
float bs_messaging_receive_float(value_t src, value_t tag);
int32_t bs_messaging_receive_boolean(value_t src, value_t tag);
value_t bs_messaging_receive_string(value_t src, value_t tag);
void bs_messaging_receive_null(value_t src, value_t tag);
value_t bs_messaging_receive_integer_array(value_t src, value_t tag);
value_t bs_messaging_receive_float_array(value_t src, value_t tag);
value_t bs_messaging_receive_boolean_array(value_t src, value_t tag);

#endif /* __BS_MESSAGING__ */
