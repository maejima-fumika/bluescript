
#include <string.h>
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include "protocol.h"
#include "./include/messaging.h"
#include "c-runtime.h"
#include "./include/std-module.h"

#define BUFF_SIZE 256

char buff[BUFF_SIZE];

void clear_buff() {
    memset(buff, 0, BUFF_SIZE);
}

void write_message_to_buff(value_t message) {
    if (is_int_value(message)) 
        sprintf(buff, "%d\n", (int) value_to_int(message));
    else if (is_float_value(message))
        sprintf(buff, "%f\n", value_to_float(message));
    else if (message == VALUE_NULL || message == VALUE_UNDEF)
        sprintf(buff, "undefined\n");
    else if (message == VALUE_TRUE)
        sprintf(buff, "true\n");
    else if (message == VALUE_FALSE)
        sprintf(buff, "false\n");
    else if (gc_is_string_object(message))
        snprintf(buff, sizeof(buff), "%s\n", gc_string_to_cstr(message));
    else {
        class_object* cls = gc_get_class_of(message);
        if (cls == NULL)
        sprintf(buff, "??\n");
        else
        snprintf(buff, sizeof(buff), "<class %s>\n", cls->name);
    }
    printf(buff);
}

void PORT_TEXT_SECTION mth_0_Console(value_t self, value_t _message);
void PORT_TEXT_SECTION mth_1_Console(value_t self, value_t _message);
float PORT_TEXT_SECTION mth_0_Time(value_t self);
void PORT_TEXT_SECTION mth_1_Time(value_t self, int32_t _ms);
extern CLASS_OBJECT(object_class, 1);
ROOT_SET_DECL(global_rootset0, 2);
static const uint16_t mnames_Console[] = { 8, 9, };
static const char* const msigs_Console[] = { "(s)v", "(s)v", };
static const uint16_t plist_Console[] = {  };
PORT_DATA_SECTION CLASS_OBJECT(class_Console, 2) = {
    .body = { .s = 0, .i = 0, .cn = "Console", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 0, .offset = 0,
    .unboxed = 0, .prop_names = plist_Console, .unboxed_types = "" }, .mt = { .size = 2, .names = mnames_Console, .signatures = msigs_Console }, .vtbl = { mth_0_Console, mth_1_Console,  }}};
static const uint16_t mnames_Time[] = { 10, 11, };
static const char* const msigs_Time[] = { "()f", "(i)v", };
static const uint16_t plist_Time[] = {  };
PORT_DATA_SECTION CLASS_OBJECT(class_Time, 2) = {
    .body = { .s = 0, .i = 0, .cn = "Time", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 0, .offset = 0,
    .unboxed = 0, .prop_names = plist_Time, .unboxed_types = "" }, .mt = { .size = 2, .names = mnames_Time, .signatures = msigs_Time }, .vtbl = { mth_0_Time, mth_1_Time,  }}};


static void fbody_print(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _message;
  {
    
    clear_buff();
    write_message_to_buff(func_rootset.values[0]);
    bs_protocol_write_log(buff);
    ;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _print = { fbody_print, "(a)v" };

static void fbody_sendInteger(value_t self, value_t _dst, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  {
    bs_messaging_send_integer(func_rootset.values[0], func_rootset.values[1], _value);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendInteger = { fbody_sendInteger, "(ssi)v" };

static void fbody_broadcastInteger(value_t self, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _tag;
  {
    bs_messaging_broadcast_integer(func_rootset.values[0], _value);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastInteger = { fbody_broadcastInteger, "(si)v" };

static int32_t fbody_receiveInteger(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    int32_t _value = 0;
    _value = bs_messaging_receive_integer(func_rootset.values[0], func_rootset.values[1]);;
    { int32_t ret_value_ = (_value); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveInteger = { fbody_receiveInteger, "(ss)i" };

static void fbody_sendFloat(value_t self, value_t _dst, value_t _tag, float _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  {
    bs_messaging_send_float(func_rootset.values[0], func_rootset.values[1], _value);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendFloat = { fbody_sendFloat, "(ssf)v" };

static void fbody_broadcastFloat(value_t self, value_t _tag, float _value) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _tag;
  {
    bs_messaging_broadcast_float(func_rootset.values[0], _value);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastFloat = { fbody_broadcastFloat, "(sf)v" };

static float fbody_receiveFloat(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    float _value = 0.0;
    _value = bs_messaging_receive_float(func_rootset.values[0], func_rootset.values[1]);;
    { float ret_value_ = (_value); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveFloat = { fbody_receiveFloat, "(ss)f" };

static void fbody_sendBoolean(value_t self, value_t _dst, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  {
    bs_messaging_send_boolean(func_rootset.values[0], func_rootset.values[1], _value);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendBoolean = { fbody_sendBoolean, "(ssb)v" };

static void fbody_broadcastBoolean(value_t self, value_t _tag, int32_t _value) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _tag;
  {
    bs_messaging_broadcast_boolean(func_rootset.values[0], _value);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastBoolean = { fbody_broadcastBoolean, "(sb)v" };

static int32_t fbody_receiveBoolean(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    int32_t _value = 0;
    _value = bs_messaging_receive_boolean(func_rootset.values[0], func_rootset.values[1]);;
    { int32_t ret_value_ = (_value); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveBoolean = { fbody_receiveBoolean, "(ss)b" };

static void fbody_sendString(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    bs_messaging_send_string(func_rootset.values[0], func_rootset.values[1], func_rootset.values[2]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendString = { fbody_sendString, "(sss)v" };

static void fbody_broadcastString(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    bs_messaging_broadcast_string(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastString = { fbody_broadcastString, "(ss)v" };

static value_t fbody_receiveString(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_string("");
    func_rootset.values[3] = bs_messaging_receive_string(func_rootset.values[0], func_rootset.values[1]);;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveString = { fbody_receiveString, "(ss)s" };

static void fbody_sendNull(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    bs_messaging_send_null(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendNull = { fbody_sendNull, "(ssn)v" };

static void fbody_broadcastNull(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    bs_messaging_broadcast_null(func_rootset.values[0]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastNull = { fbody_broadcastNull, "(sn)v" };

static value_t fbody_receiveNull(value_t self, value_t _src, value_t _tag) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    bs_messaging_receive_null(func_rootset.values[0], func_rootset.values[1]);;
    { value_t ret_value_ = (VALUE_NULL); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveNull = { fbody_receiveNull, "(ss)n" };

static void fbody_sendIntegerArray(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    bs_messaging_send_integer_array(func_rootset.values[0], func_rootset.values[1], func_rootset.values[2]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendIntegerArray = { fbody_sendIntegerArray, "(ss[i)v" };

static void fbody_broadcastIntegerArray(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    bs_messaging_broadcast_integer_array(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastIntegerArray = { fbody_broadcastIntegerArray, "(s[i)v" };

static value_t fbody_receiveIntegerArray(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_intarray(0, 0);
    func_rootset.values[3] = bs_messaging_receive_integer_array(func_rootset.values[0], func_rootset.values[1]);;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveIntegerArray = { fbody_receiveIntegerArray, "(ss)[i" };

static void fbody_sendFloatArray(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    bs_messaging_send_float_array(func_rootset.values[0], func_rootset.values[1], func_rootset.values[2]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendFloatArray = { fbody_sendFloatArray, "(ss[f)v" };

static void fbody_broadcastFloatArray(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    bs_messaging_broadcast_float_array(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastFloatArray = { fbody_broadcastFloatArray, "(s[f)v" };

static value_t fbody_receiveFloatArray(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_floatarray(0, 0.0);
    func_rootset.values[3] = bs_messaging_receive_float_array(func_rootset.values[0], func_rootset.values[1]);;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveFloatArray = { fbody_receiveFloatArray, "(ss)[f" };

static void fbody_sendBooleanArray(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    bs_messaging_send_boolean_array(func_rootset.values[0], func_rootset.values[1], func_rootset.values[2]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendBooleanArray = { fbody_sendBooleanArray, "(ss[b)v" };

static void fbody_broadcastBooleanArray(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    bs_messaging_broadcast_boolean_array(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastBooleanArray = { fbody_broadcastBooleanArray, "(s[b)v" };

static value_t fbody_receiveBooleanArray(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_new_bytearray(true, 0, 0);
    func_rootset.values[3] = bs_messaging_receive_boolean_array(func_rootset.values[0], func_rootset.values[1]);;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveBooleanArray = { fbody_receiveBooleanArray, "(ss)[b" };

static void fbody_sendArray(value_t self, value_t _dst, value_t _tag, value_t _value) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _dst;
  func_rootset.values[1] = _tag;
  func_rootset.values[2] = _value;
  {
    bs_messaging_send_array(func_rootset.values[0], func_rootset.values[1], func_rootset.values[2]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _sendArray = { fbody_sendArray, "(ss[a)v" };

static void fbody_broadcastArray(value_t self, value_t _tag, value_t _value) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _tag;
  func_rootset.values[1] = _value;
  {
    bs_messaging_broadcast_array(func_rootset.values[0], func_rootset.values[1]);;
  }
  DELETE_ROOT_SET(func_rootset)
}
PORT_DATA_SECTION const struct func_body _broadcastArray = { fbody_broadcastArray, "(s[a)v" };

static value_t fbody_receiveArray(value_t self, value_t _src, value_t _tag) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _tag;
  {
    func_rootset.values[3] = gc_make_array((void*)0, 0);
    func_rootset.values[3] = bs_messaging_receive_array(func_rootset.values[0], func_rootset.values[1]);;
    { value_t ret_value_ = (func_rootset.values[3]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
PORT_DATA_SECTION const struct func_body _receiveArray = { fbody_receiveArray, "(ss)[a" };


void mth_0_Console(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _message;
  {
    
    clear_buff();
    write_message_to_buff(func_rootset.values[1]);
    bs_protocol_write_log(buff);
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_Console(value_t self, value_t _message) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _message;
  {
    
    clear_buff();
    write_message_to_buff(func_rootset.values[1]);
    bs_protocol_write_error(buff);
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Console(value_t self) { return self; }


float mth_0_Time(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    float _currentTime = 0.0;
    _currentTime = esp_timer_get_time() / 1000.0;;
    { float ret_value_ = (_currentTime); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void mth_1_Time(value_t self, int32_t _ms) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    vTaskDelay(pdMS_TO_TICKS(_ms));;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Time(value_t self) { return self; }


void bs_stdmodule_main() {
  ROOT_SET_INIT(global_rootset0, 2)
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  set_global_variable(&global_rootset0.values[0], new_Console(func_rootset.values[0]=gc_new_object(&class_Console.clazz)));
  set_global_variable(&global_rootset0.values[1], new_Time(func_rootset.values[0]=gc_new_object(&class_Time.clazz)));
  DELETE_ROOT_SET(func_rootset)
}
