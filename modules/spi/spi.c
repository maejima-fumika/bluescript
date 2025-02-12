
#include <stdint.h>
#include "c-runtime.h"
value_t new_115112105SPI(value_t self, int32_t p0, value_t p1, value_t p2, value_t p3);
void mth_0_115112105SPI(value_t self);
void mth_1_115112105SPI(value_t self);
void mth_2_115112105SPI(value_t self, int32_t _cmd);
extern CLASS_OBJECT(object_class, 1);
extern CLASS_OBJECT(class_103112105111GPIO, 1); extern value_t new_103112105111GPIO(value_t, int32_t);
void bluescript_main0_115112105();
ROOT_SET_DECL(global_rootset0_115112105, 0);
static const uint16_t mnames_115112105SPI[] = { 5, 6, 7, };
static const char* const msigs_115112105SPI[] = { "()v", "()v", "(i)v", };
static const uint16_t plist_115112105SPI[] = { 1, 2, 3, 4 };
CLASS_OBJECT(class_115112105SPI, 3) = {
    .body = { .s = 4, .i = 1, .cn = "115112105SPI", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 4, .offset = 0,
    .unboxed = 1, .prop_names = plist_115112105SPI, .unboxed_types = "i" }, .mt = { .size = 3, .names = mnames_115112105SPI, .signatures = msigs_115112105SPI }, .vtbl = { mth_0_115112105SPI, mth_1_115112105SPI, mth_2_115112105SPI,  }}};

static void cons_115112105SPI(value_t self, int32_t _baudrate, value_t _sck, value_t _mosi, value_t _miso) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _sck;
  func_rootset.values[2] = _mosi;
  func_rootset.values[3] = _miso;
  {
    *get_obj_int_property(self, 0) = _baudrate;
    set_obj_property(self, 1, func_rootset.values[1]);
    set_obj_property(self, 2, func_rootset.values[2]);
    set_obj_property(self, 3, func_rootset.values[3]);
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_115112105SPI(value_t self, int32_t p0, value_t p1, value_t p2, value_t p3) { cons_115112105SPI(self, p0, p1, p2, p3); return self; }


void mth_0_115112105SPI(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_115112105SPI(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_2_115112105SPI(value_t self, int32_t _cmd) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}

void bluescript_main0_115112105() {
  ROOT_SET_INIT(global_rootset0_115112105, 0)
  
  
}
