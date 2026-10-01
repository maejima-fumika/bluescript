
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include "../../core/include/c-runtime.h"
#include "./comm.h"
#ifndef _WIN32
#include <dlfcn.h>
#include <time.h>
#else
#include <windows.h>
#endif


void send_message(const char* format, ...) {
  static char message[MAX_LINE_SIZE];
  va_list list;
  va_start(list, format);
  vsnprintf(message, MAX_LINE_SIZE, format, list);
  bs_comm_send_log(message);
}

void print_message(value_t m) { 
    static char buffer[256];
    if (is_int_value(m))
        send_message("%d\n", value_to_int(m));
    else if (is_float_value(m))
        send_message("%f\n", value_to_float(m));
    else if (m == VALUE_NULL || m == VALUE_UNDEF)
        send_message("undefined\n");
    else if (m == VALUE_TRUE)
        send_message("true\n");
    else if (m == VALUE_FALSE)
        send_message("false\n");
    else if (gc_is_string_object(m))
        send_message("'%s'\n", gc_string_to_cstr(m));
    else {
        class_object* cls = gc_get_class_of(m);
        if (cls == NULL)
        send_message("??\n");
        else
        send_message("<class %s>\n", cls->name);
    }
}

// Messages between the projects in a workspace (see bscript workspace run).
// A value travels as <type char><text> (see comm.h); these helpers convert it.

static char messaging_error[256];
static char message_text[MAX_PAYLOAD_SIZE + 1];

static void msg_check(int result) {
    if (result < 0)
        runtime_error(messaging_error);
}

static void msg_too_large() {
    runtime_error("the value is too large to send");
}

// Appends to message_text, or raises a runtime error when it is full.
static int message_len;

static void msg_begin(char type) {
    message_text[0] = type;
    message_text[1] = '\0';
    message_len = 1;
}

static void msg_append(const char* format, ...) {
    va_list list;
    va_start(list, format);
    int n = vsnprintf(message_text + message_len, sizeof(message_text) - message_len, format, list);
    va_end(list);
    if (n < 0 || message_len + n >= MAX_PAYLOAD_SIZE)
        msg_too_large();
    message_len += n;
}

static void msg_send(value_t dst, value_t tag) {
    msg_check(bs_comm_send_message(gc_string_to_cstr(dst), gc_string_to_cstr(tag), message_text,
                                   messaging_error, sizeof(messaging_error)));
}

static void msg_broadcast(value_t tag) {
    msg_check(bs_comm_broadcast_message(gc_string_to_cstr(tag), message_text,
                                        messaging_error, sizeof(messaging_error)));
}

// Returns the text of the received value (without the type char).
static const char* msg_receive(value_t src, value_t tag, char type) {
    msg_check(bs_comm_receive_message(gc_string_to_cstr(src), gc_string_to_cstr(tag), type, message_text,
                                      messaging_error, sizeof(messaging_error)));
    return message_text;
}

// Builds message_text for each type.

static void msg_format_integer(int32_t value) {
    msg_begin(MSG_TYPE_INTEGER);
    msg_append("%d", (int)value);
}

static void msg_format_float(float value) {
    msg_begin(MSG_TYPE_FLOAT);
    msg_append("%.9g", value);
}

static void msg_format_boolean(int32_t value) {
    msg_begin(MSG_TYPE_BOOLEAN);
    msg_append("%d", value ? 1 : 0);
}

static void msg_format_string(value_t value) {
    msg_begin(MSG_TYPE_STRING);
    for (const unsigned char* p = (const unsigned char*)gc_string_to_cstr(value); *p != '\0'; p++)
        msg_append("%02x", *p);
}

static void msg_format_null() {
    msg_begin(MSG_TYPE_NULL);
}

static void msg_format_integer_array(value_t value) {
    msg_begin(MSG_TYPE_INTEGER_ARRAY);
    int32_t n = gc_intarray_length(value);
    for (int32_t i = 0; i < n; i++)
        msg_append(i == 0 ? "%d" : ",%d", (int)*gc_intarray_get(value, i));
}

static void msg_format_float_array(value_t value) {
    msg_begin(MSG_TYPE_FLOAT_ARRAY);
    int32_t n = gc_floatarray_length(value);
    for (int32_t i = 0; i < n; i++)
        msg_append(i == 0 ? "%.9g" : ",%.9g", *gc_floatarray_get(value, i));
}

static void msg_format_boolean_array(value_t value) {
    msg_begin(MSG_TYPE_BOOLEAN_ARRAY);
    int32_t n = gc_bytearray_length(value);
    for (int32_t i = 0; i < n; i++)
        msg_append("%d", *gc_bytearray_get(value, i) ? 1 : 0);
}

// Converts the received text into a value of each type.

static int32_t msg_parse_integer(const char* text) {
    return (int32_t)strtol(text, NULL, 10);
}

static float msg_parse_float(const char* text) {
    return strtof(text, NULL);
}

static int32_t msg_parse_boolean(const char* text) {
    return text[0] == '1';
}

static int hex_digit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0;
}

static value_t msg_parse_string(const char* text) {
    static char bytes[MAX_PAYLOAD_SIZE / 2 + 1];
    int32_t len = (int32_t)strlen(text) / 2;
    for (int32_t i = 0; i < len; i++)
        bytes[i] = (char)(hex_digit(text[2 * i]) * 16 + hex_digit(text[2 * i + 1]));
    return gc_new_string_copy(bytes, len);
}

// The number of elements in a comma-separated list.
static int32_t msg_count_list(const char* text) {
    if (text[0] == '\0')
        return 0;
    int32_t n = 1;
    for (const char* p = text; *p != '\0'; p++)
        if (*p == ',')
            n++;
    return n;
}

static value_t msg_parse_integer_array(const char* text) {
    int32_t n = msg_count_list(text);
    value_t array = gc_new_intarray(n, 0);
    char* p = (char*)text;
    for (int32_t i = 0; i < n; i++) {
        *gc_intarray_get(array, i) = (int32_t)strtol(p, &p, 10);
        if (*p == ',') p++;
    }
    return array;
}

static value_t msg_parse_float_array(const char* text) {
    int32_t n = msg_count_list(text);
    value_t array = gc_new_floatarray(n, 0.0f);
    char* p = (char*)text;
    for (int32_t i = 0; i < n; i++) {
        *gc_floatarray_get(array, i) = strtof(p, &p);
        if (*p == ',') p++;
    }
    return array;
}

static value_t msg_parse_boolean_array(const char* text) {
    int32_t n = (int32_t)strlen(text);
    value_t array = gc_new_bytearray(true, n, 0);
    for (int32_t i = 0; i < n; i++)
        *gc_bytearray_get(array, i) = text[i] == '1';
    return array;
}

static float get_time_ms() {
#ifndef _WIN32
    static struct timespec ts0 = { 0, -1 };
    struct timespec ts;
    if (ts0.tv_nsec < 0)
        clock_gettime(CLOCK_REALTIME, &ts0);

    clock_gettime(CLOCK_REALTIME, &ts);
    return (float)(ts.tv_sec - ts0.tv_sec) * 1000.0 + (float)(ts.tv_nsec - ts0.tv_nsec) / 1000000.0;
#else
    static LARGE_INTEGER freq = { 0 };
    static LARGE_INTEGER start = { 0 };
    LARGE_INTEGER now;
    if (freq.QuadPart == 0) {
        QueryPerformanceFrequency(&freq);
        QueryPerformanceCounter(&start);
    }
    QueryPerformanceCounter(&now);
    return (float)(now.QuadPart - start.QuadPart) * 1000.0f / (float)freq.QuadPart;
#endif
}

extern struct func_body _print;
extern struct func_body _sendInteger;
extern struct func_body _broadcastInteger;
extern struct func_body _receiveInteger;
extern struct func_body _sendFloat;
extern struct func_body _broadcastFloat;
extern struct func_body _receiveFloat;
extern struct func_body _sendBoolean;
extern struct func_body _broadcastBoolean;
extern struct func_body _receiveBoolean;
extern struct func_body _sendString;
extern struct func_body _broadcastString;
extern struct func_body _receiveString;
extern struct func_body _sendNull;
extern struct func_body _broadcastNull;
extern struct func_body _receiveNull;
extern struct func_body _sendIntegerArray;
extern struct func_body _broadcastIntegerArray;
extern struct func_body _receiveIntegerArray;
extern struct func_body _sendFloatArray;
extern struct func_body _broadcastFloatArray;
extern struct func_body _receiveFloatArray;
extern struct func_body _sendBooleanArray;
extern struct func_body _broadcastBooleanArray;
extern struct func_body _receiveBooleanArray;
void mth_0_Console(value_t self, value_t _message);
void mth_1_Console(value_t self, value_t _message);
float mth_0_Time(value_t self);
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_();
ROOT_SET_DECL(global_rootset0, 2);
static const uint16_t mnames_Console[] = { 8, 9, };
static const char* const msigs_Console[] = { "(a)v", "(a)v", };
static const uint16_t plist_Console[] = {  };
CLASS_OBJECT(class_Console, 2) = {
    .body = { .s = 0, .i = 0, .cn = "Console", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 0, .offset = 0,
    .unboxed = 0, .prop_names = plist_Console, .unboxed_types = "" }, .mt = { .size = 2, .names = mnames_Console, .signatures = msigs_Console }, .vtbl = { mth_0_Console, mth_1_Console,  }}};
static const uint16_t mnames_Time[] = { 10, };
static const char* const msigs_Time[] = { "()f", };
static const uint16_t plist_Time[] = {  };
CLASS_OBJECT(class_Time, 1) = {
    .body = { .s = 0, .i = 0, .cn = "Time", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 0, .offset = 0,
    .unboxed = 0, .prop_names = plist_Time, .unboxed_types = "" }, .mt = { .size = 1, .names = mnames_Time, .signatures = msigs_Time }, .vtbl = { mth_0_Time,  }}};

static void fbody_print(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _message;
  {
    print_message(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _print = { fbody_print, "(a)v" };

static void fbody_sendInteger(value_t self, value_t _dst, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  {
    msg_format_integer(_value); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendInteger = { fbody_sendInteger, "(ssi)v" };

static void fbody_broadcastInteger(value_t self, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _tag;
  {
    msg_format_integer(_value); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastInteger = { fbody_broadcastInteger, "(si)v" };

static int32_t fbody_receiveInteger(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    int32_t _value = 0;
    _value = msg_parse_integer(msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_INTEGER));;
    { int32_t ret_value_ = (_value); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveInteger = { fbody_receiveInteger, "(ss)i" };

static void fbody_sendFloat(value_t self, value_t _dst, value_t _tag, float _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  {
    msg_format_float(_value); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendFloat = { fbody_sendFloat, "(ssf)v" };

static void fbody_broadcastFloat(value_t self, value_t _tag, float _value) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _tag;
  {
    msg_format_float(_value); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastFloat = { fbody_broadcastFloat, "(sf)v" };

static float fbody_receiveFloat(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    float _value = 0.0;
    _value = msg_parse_float(msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_FLOAT));;
    { float ret_value_ = (_value); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveFloat = { fbody_receiveFloat, "(ss)f" };

static void fbody_sendBoolean(value_t self, value_t _dst, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  {
    msg_format_boolean(_value); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendBoolean = { fbody_sendBoolean, "(ssb)v" };

static void fbody_broadcastBoolean(value_t self, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _tag;
  {
    msg_format_boolean(_value); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastBoolean = { fbody_broadcastBoolean, "(sb)v" };

static int32_t fbody_receiveBoolean(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    int32_t _value = 0;
    _value = msg_parse_boolean(msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_BOOLEAN));;
    { int32_t ret_value_ = (_value); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveBoolean = { fbody_receiveBoolean, "(ss)b" };

static void fbody_sendString(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    msg_format_string(func_rootset.values[2]); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendString = { fbody_sendString, "(sss)v" };

static void fbody_broadcastString(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    msg_format_string(func_rootset.values[1]); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastString = { fbody_broadcastString, "(ss)v" };

static value_t fbody_receiveString(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_string("");
    func_rootset.values[3] = msg_parse_string(msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_STRING));;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveString = { fbody_receiveString, "(ss)s" };

static void fbody_sendNull(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    msg_format_null(); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendNull = { fbody_sendNull, "(ssn)v" };

static void fbody_broadcastNull(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    msg_format_null(); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastNull = { fbody_broadcastNull, "(sn)v" };

static value_t fbody_receiveNull(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_NULL);;
    { value_t ret_value_ = (VALUE_NULL); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveNull = { fbody_receiveNull, "(ss)n" };

static void fbody_sendIntegerArray(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    msg_format_integer_array(func_rootset.values[2]); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendIntegerArray = { fbody_sendIntegerArray, "(ss[i)v" };

static void fbody_broadcastIntegerArray(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    msg_format_integer_array(func_rootset.values[1]); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastIntegerArray = { fbody_broadcastIntegerArray, "(s[i)v" };

static value_t fbody_receiveIntegerArray(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_intarray(0, 0);
    func_rootset.values[3] = msg_parse_integer_array(msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_INTEGER_ARRAY));;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveIntegerArray = { fbody_receiveIntegerArray, "(ss)[i" };

static void fbody_sendFloatArray(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    msg_format_float_array(func_rootset.values[2]); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendFloatArray = { fbody_sendFloatArray, "(ss[f)v" };

static void fbody_broadcastFloatArray(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    msg_format_float_array(func_rootset.values[1]); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastFloatArray = { fbody_broadcastFloatArray, "(s[f)v" };

static value_t fbody_receiveFloatArray(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_floatarray(0, 0.0);
    func_rootset.values[3] = msg_parse_float_array(msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_FLOAT_ARRAY));;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveFloatArray = { fbody_receiveFloatArray, "(ss)[f" };

static void fbody_sendBooleanArray(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    msg_format_boolean_array(func_rootset.values[2]); msg_send(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _sendBooleanArray = { fbody_sendBooleanArray, "(ss[b)v" };

static void fbody_broadcastBooleanArray(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    msg_format_boolean_array(func_rootset.values[1]); msg_broadcast(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _broadcastBooleanArray = { fbody_broadcastBooleanArray, "(s[b)v" };

static value_t fbody_receiveBooleanArray(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_bytearray(true, 0, 0);
    func_rootset.values[3] = msg_parse_boolean_array(msg_receive(func_rootset.values[0], func_rootset.values[1], MSG_TYPE_BOOLEAN_ARRAY));;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _receiveBooleanArray = { fbody_receiveBooleanArray, "(ss)[b" };

void mth_0_Console(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _message;
  {
    print_message(func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_Console(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _message;
  {
    print_message(func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Console(value_t self) { return self; }


float mth_0_Time(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    int32_t _t = 0;
    _t = get_time_ms();;
    { float ret_value_ = (_t); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

value_t new_Time(value_t self) { return self; }


void bluescript_main0_() {
  ROOT_SET_INIT(global_rootset0, 2)
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  ;
  set_global_variable(&global_rootset0.values[0], new_Console(func_rootset.values[0]=gc_new_object(&class_Console.clazz)));
  set_global_variable(&global_rootset0.values[1], new_Time(func_rootset.values[0]=gc_new_object(&class_Time.clazz)));
  DELETE_ROOT_SET(func_rootset)
}
