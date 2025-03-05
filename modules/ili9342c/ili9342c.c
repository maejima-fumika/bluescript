
#include <stdint.h>
#include "c-runtime.h"
int32_t _1051081055751525100ILI9342C_HEIGHT;
int32_t _1051081055751525100ILI9342C_WIDTH;
int32_t _1051081055751525100MAX_LINE_NUM;
int32_t _1051081055751525100MAX_TRANSFER_SIZE;
extern struct func_body _1051081055751525100intArrayToUint8Array;
value_t new_1051081055751525100ILI9342C(value_t self, int32_t p0, int32_t p1, int32_t p2, int32_t p3, int32_t p4, int32_t p5, int32_t p6);
void mth_0_1051081055751525100ILI9342C(value_t self, value_t _frame);
void mth_1_1051081055751525100ILI9342C(value_t self, value_t _buff, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1);
extern CLASS_OBJECT(object_class, 1);
extern CLASS_OBJECT(class_103112105111GPIO, 1); extern value_t new_103112105111GPIO(value_t, int32_t, int32_t);
extern int32_t _103112105111GPIO_OUTPUT;
extern CLASS_OBJECT(class_115112105SPI, 1); extern value_t new_115112105SPI(value_t, int32_t, int32_t, int32_t, int32_t, int32_t, int32_t, int32_t, int32_t);
extern struct func_body _116105109101114waitMs;
extern void fbody_116105109101114waitMs(value_t self, int32_t p0);
extern CLASS_OBJECT(class_10211497109101FrameBuffer, 1); extern value_t new_10211497109101FrameBuffer(value_t, value_t, int32_t);
extern CLASS_OBJECT(class_Uint8Array, 1); extern value_t new_Uint8Array(value_t, int32_t, int32_t);
void bluescript_main0_1051081055751525100();
ROOT_SET_DECL(global_rootset0_1051081055751525100, 0);

value_t fbody_1051081055751525100intArrayToUint8Array(value_t self, value_t _intArray) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _intArray;
  {
    int32_t _length = *get_obj_int_property(func_rootset.values[0], 0);
    func_rootset.values[2] = gc_new_bytearray(false, _length, 0);
    for (
    int32_t _i = 0;_i < _length; (_i)++) {
      (*gc_bytearray_get(func_rootset.values[2], _i)) = (*gc_intarray_get(func_rootset.values[0], _i));
    }
    { value_t ret_value_ = (func_rootset.values[2]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _1051081055751525100intArrayToUint8Array = { fbody_1051081055751525100intArrayToUint8Array, "([i)'Uint8Array'" };
static const uint16_t mnames_1051081055751525100ILI9342C[] = { 28, 29, };
static const char* const msigs_1051081055751525100ILI9342C[] = { "('10211497109101FrameBuffer')v", "('Uint8Array'iiii)v", };
static const uint16_t plist_1051081055751525100ILI9342C[] = { 27 };
CLASS_OBJECT(class_1051081055751525100ILI9342C, 2) = {
    .body = { .s = 1, .i = 0, .cn = "1051081055751525100ILI9342C", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 1, .offset = 0,
    .unboxed = 0, .prop_names = plist_1051081055751525100ILI9342C, .unboxed_types = "" }, .mt = { .size = 2, .names = mnames_1051081055751525100ILI9342C, .signatures = msigs_1051081055751525100ILI9342C }, .vtbl = { mth_0_1051081055751525100ILI9342C, mth_1_1051081055751525100ILI9342C,  }}};

static void cons_1051081055751525100ILI9342C(value_t self, int32_t _sck, int32_t _mosi, int32_t _miso, int32_t _cs, int32_t _dc, int32_t _rst, int32_t _bckl) {
  ROOT_SET(func_rootset,6)
  func_rootset.values[0] = self;
  {
    set_obj_property(self, 0, new_115112105SPI(gc_new_object(&class_115112105SPI.clazz), 10 * 1000 * 1000, 0, _1051081055751525100MAX_TRANSFER_SIZE, _sck, _mosi, _miso, _cs, _dc));
    func_rootset.values[1] = new_103112105111GPIO(gc_new_object(&class_103112105111GPIO.clazz), _rst, _103112105111GPIO_OUTPUT);
    func_rootset.values[2] = new_103112105111GPIO(gc_new_object(&class_103112105111GPIO.clazz), _bckl, _103112105111GPIO_OUTPUT);
    (func_rootset.values[3] = func_rootset.values[1], ((void (*)(value_t))gc_method_lookup(func_rootset.values[3], 2))(func_rootset.values[3]));
    (func_rootset.values[3] = func_rootset.values[2], ((void (*)(value_t))gc_method_lookup(func_rootset.values[3], 2))(func_rootset.values[3]));
    fbody_116105109101114waitMs(0, 100);
    (func_rootset.values[3] = func_rootset.values[1], ((void (*)(value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3]));
    fbody_116105109101114waitMs(0, 100);
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xc0));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(1, (int32_t)(0x23)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xc1));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(1, (int32_t)(0x10)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xc5));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(2, (int32_t)(0x3e), (int32_t)(0x28)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xc7));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(1, (int32_t)(0x86)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0x36));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(1, (int32_t)(0x08)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0x3a));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(1, (int32_t)(0x55)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xb1));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(2, (int32_t)(0x00), (int32_t)(0x18)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xb6));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(3, (int32_t)(0x08), (int32_t)(0x82), (int32_t)(0x27)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xf2));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(1, (int32_t)(0x00)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0x26));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(1, (int32_t)(0x01)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xe0));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(15, (int32_t)(0x0f), (int32_t)(0x31), (int32_t)(0x2b), (int32_t)(0x0c), (int32_t)(0x0e), (int32_t)(0x08), (int32_t)(0x4e), (int32_t)(0xf1), (int32_t)(0x37), (int32_t)(0x07), (int32_t)(0x10), (int32_t)(0x03), (int32_t)(0x0e), (int32_t)(0x09), (int32_t)(0x00)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0xe1));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[4]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[5]=gc_make_intarray(15, (int32_t)(0x00), (int32_t)(0x0e), (int32_t)(0x14), (int32_t)(0x03), (int32_t)(0x11), (int32_t)(0x07), (int32_t)(0x31), (int32_t)(0xc1), (int32_t)(0x48), (int32_t)(0x08), (int32_t)(0x0f), (int32_t)(0x0c), (int32_t)(0x31), (int32_t)(0x36), (int32_t)(0x0f)))));
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0x21));
    fbody_116105109101114waitMs(0, 100);
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0x11));
    fbody_116105109101114waitMs(0, 100);
    (func_rootset.values[3] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[3], 0))(func_rootset.values[3], 0x29));
    fbody_116105109101114waitMs(0, 100);
    (func_rootset.values[3] = func_rootset.values[2], ((void (*)(value_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3]));
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_1051081055751525100ILI9342C(value_t self, int32_t p0, int32_t p1, int32_t p2, int32_t p3, int32_t p4, int32_t p5, int32_t p6) { cons_1051081055751525100ILI9342C(self, p0, p1, p2, p3, p4, p5, p6); return self; }


void mth_0_1051081055751525100ILI9342C(value_t self, value_t _frame) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _frame;
  {
    for (
    int32_t _i = 0;_i < _1051081055751525100ILI9342C_HEIGHT / _1051081055751525100MAX_LINE_NUM; (_i)++) {
      int32_t _x0 = 0;
      int32_t _y0 = _1051081055751525100MAX_LINE_NUM * _i;
      int32_t _x1 = _1051081055751525100ILI9342C_WIDTH - 1;
      int32_t _y1 = _y0 + _1051081055751525100MAX_LINE_NUM - 1;
      func_rootset.values[2] = (func_rootset.values[3] = func_rootset.values[1], ((value_t (*)(value_t, int32_t, int32_t, int32_t, int32_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], _x0, _y0, _x1, _y1));
      (func_rootset.values[3] = self, ((void (*)(value_t, value_t, int32_t, int32_t, int32_t, int32_t))gc_method_lookup(func_rootset.values[3], 1))(func_rootset.values[3], func_rootset.values[2], _x0, _y0, _x1, _y1));
      fbody_116105109101114waitMs(0, 3000);
    }
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_1051081055751525100ILI9342C(value_t self, value_t _buff, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1) {
  ROOT_SET(func_rootset,5)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _buff;
  {
    (func_rootset.values[2] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[2], 0))(func_rootset.values[2], 0x2a));
    (func_rootset.values[2] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[2], 1))(func_rootset.values[2], func_rootset.values[3]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[4]=gc_make_intarray(4, (int32_t)(_x0 >> 8), (int32_t)(_x0 & 0xff), (int32_t)(_x1 >> 8), (int32_t)(_x1 & 0xff)))));
    (func_rootset.values[2] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[2], 0))(func_rootset.values[2], 0x2b));
    (func_rootset.values[2] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[2], 1))(func_rootset.values[2], func_rootset.values[3]=fbody_1051081055751525100intArrayToUint8Array(0, func_rootset.values[4]=gc_make_intarray(4, (int32_t)(_y0 >> 8), (int32_t)(_y0 & 0xff), (int32_t)(_y1 >> 8), (int32_t)(_y1 & 0xff)))));
    (func_rootset.values[2] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[2], 0))(func_rootset.values[2], 0x2c));
    (func_rootset.values[2] = safe_value_to_value(false, &class_115112105SPI.clazz, get_obj_property(self, 0)), ((void (*)(value_t, value_t))gc_method_lookup(func_rootset.values[2], 1))(func_rootset.values[2], func_rootset.values[1]));
  }
  DELETE_ROOT_SET(func_rootset)
}

void bluescript_main0_1051081055751525100() {
  ROOT_SET_INIT(global_rootset0_1051081055751525100, 0)
  
  _1051081055751525100ILI9342C_HEIGHT = 240; _1051081055751525100ILI9342C_HEIGHT = _1051081055751525100ILI9342C_HEIGHT;
  _1051081055751525100ILI9342C_WIDTH = 320; _1051081055751525100ILI9342C_WIDTH = _1051081055751525100ILI9342C_WIDTH;
  _1051081055751525100MAX_LINE_NUM = 30; _1051081055751525100MAX_LINE_NUM = _1051081055751525100MAX_LINE_NUM;
  _1051081055751525100MAX_TRANSFER_SIZE = _1051081055751525100ILI9342C_WIDTH * _1051081055751525100MAX_LINE_NUM * 2 + 8; _1051081055751525100MAX_TRANSFER_SIZE = _1051081055751525100MAX_TRANSFER_SIZE;
  
}
