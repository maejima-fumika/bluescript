
#include <stdint.h>
#include "c-runtime.h"
value_t new_10211497109101RGB565(value_t self, int32_t p0, int32_t p1, int32_t p2);
int32_t mth_0_10211497109101RGB565(value_t self);
value_t new_10211497109101Layer(value_t self);
void mth_0_10211497109101Layer(value_t self, value_t _buff, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1);
value_t new_10211497109101FilledCircle(value_t self, int32_t p0, int32_t p1, int32_t p2, value_t p3);
void mth_0_10211497109101FilledCircle(value_t self, value_t _buff, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1);
value_t new_10211497109101FrameBuffer(value_t self, value_t p0, int32_t p1);
void mth_0_10211497109101FrameBuffer(value_t self, int32_t _x, int32_t _y, int32_t _r, value_t _color);
value_t mth_1_10211497109101FrameBuffer(value_t self, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1);
void mth_2_10211497109101FrameBuffer(value_t self);
extern CLASS_OBJECT(object_class, 1);
extern CLASS_OBJECT(class_Uint8Array, 1); extern value_t new_Uint8Array(value_t, int32_t, int32_t);
CLASS_OBJECT(array_type0, 0) = { .body = { .s = 2, .i = 1, .cn = "Layer[]", .sc = &object_class.clazz, .an = "['10211497109101Layer'", .pt = { .size = 0, .offset = 0, .unboxed = 0, .prop_names = (void*)0, .unboxed_types = (void*)0 }, .vtbl = {}}};
void bluescript_main0_10211497109101();
ROOT_SET_DECL(global_rootset0_10211497109101, 0);
static const uint16_t mnames_10211497109101RGB565[] = { 4, };
static const char* const msigs_10211497109101RGB565[] = { "()i", };
static const uint16_t plist_10211497109101RGB565[] = { 1, 2, 3 };
CLASS_OBJECT(class_10211497109101RGB565, 1) = {
    .body = { .s = 3, .i = 3, .cn = "10211497109101RGB565", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 3, .offset = 0,
    .unboxed = 3, .prop_names = plist_10211497109101RGB565, .unboxed_types = "iii" }, .mt = { .size = 1, .names = mnames_10211497109101RGB565, .signatures = msigs_10211497109101RGB565 }, .vtbl = { mth_0_10211497109101RGB565,  }}};

static void cons_10211497109101RGB565(value_t self, int32_t _red, int32_t _green, int32_t _blue) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = _red;
    *get_obj_int_property(self, 1) = _green;
    *get_obj_int_property(self, 2) = _blue;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_10211497109101RGB565(value_t self, int32_t p0, int32_t p1, int32_t p2) { cons_10211497109101RGB565(self, p0, p1, p2); return self; }


int32_t mth_0_10211497109101RGB565(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    int32_t _color = 0;
    _color |= ((*get_obj_int_property(self, 0) >> 3) << 11);
    _color |= ((*get_obj_int_property(self, 1) >> 2) << 5);
    _color |= ((*get_obj_int_property(self, 2) >> 3) << 0);
    _color = (_color >> 8) | (_color << 8);
    { int32_t ret_value_ = (_color); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
static const uint16_t mnames_10211497109101Layer[] = { 5, };
static const char* const msigs_10211497109101Layer[] = { "('Uint8Array'iiii)v", };
static const uint16_t plist_10211497109101Layer[] = {  };
CLASS_OBJECT(class_10211497109101Layer, 1) = {
    .body = { .s = 0, .i = 0, .cn = "10211497109101Layer", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 0, .offset = 0,
    .unboxed = 0, .prop_names = plist_10211497109101Layer, .unboxed_types = "" }, .mt = { .size = 1, .names = mnames_10211497109101Layer, .signatures = msigs_10211497109101Layer }, .vtbl = { mth_0_10211497109101Layer,  }}};

static void cons_10211497109101Layer(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_10211497109101Layer(value_t self) { cons_10211497109101Layer(self); return self; }


void mth_0_10211497109101Layer(value_t self, value_t _buff, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _buff;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}
static const uint16_t mnames_10211497109101FilledCircle[] = { 5, };
static const char* const msigs_10211497109101FilledCircle[] = { "('Uint8Array'iiii)v", };
static const uint16_t plist_10211497109101FilledCircle[] = { 6, 7, 8, 9 };
CLASS_OBJECT(class_10211497109101FilledCircle, 1) = {
    .body = { .s = 4, .i = 3, .cn = "10211497109101FilledCircle", .sc = &class_10211497109101Layer.clazz , .an = (void*)0, .pt = { .size = 4, .offset = 0,
    .unboxed = 3, .prop_names = plist_10211497109101FilledCircle, .unboxed_types = "iii" }, .mt = { .size = 1, .names = mnames_10211497109101FilledCircle, .signatures = msigs_10211497109101FilledCircle }, .vtbl = { mth_0_10211497109101FilledCircle,  }}};

static void cons_10211497109101FilledCircle(value_t self, int32_t _x, int32_t _y, int32_t _r, value_t _color) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _color;
  {
    new_10211497109101Layer(self);
    *get_obj_int_property(self, 0) = _x;
    *get_obj_int_property(self, 1) = _y;
    *get_obj_int_property(self, 2) = _r;
    set_obj_property(self, 3, func_rootset.values[1]);
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_10211497109101FilledCircle(value_t self, int32_t p0, int32_t p1, int32_t p2, value_t p3) { cons_10211497109101FilledCircle(self, p0, p1, p2, p3); return self; }


void mth_0_10211497109101FilledCircle(value_t self, value_t _buff, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _buff;
  {
    int32_t _buffWidth = _x1 - _x0;
    int32_t _buffHeight = _y1 - _y0;
    int32_t _centerX = *get_obj_int_property(self, 0);
    int32_t _centerY = *get_obj_int_property(self, 1);
    int32_t _radius = *get_obj_int_property(self, 2);
    int32_t _color = (func_rootset.values[2] = safe_value_to_value(false, &class_10211497109101RGB565.clazz, get_obj_property(self, 3)), ((int32_t (*)(value_t))gc_method_lookup(func_rootset.values[2], 0))(func_rootset.values[2]));
    for (
    int32_t _y = 0;_y < _buffHeight; (_y)++) {
      for (
      int32_t _x = 0;_x < _buffWidth; (_x)++) {
        if ((_x + _x0 - _centerX) * (_x + _x0 - _centerX) + (_y + _y0 - _centerY) * (_y + _y0 - _centerY) < _radius * _radius) 
          (*gc_bytearray_get(func_rootset.values[1], _y * _buffWidth + _x)) = _color;
      }
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
static const uint16_t mnames_10211497109101FrameBuffer[] = { 13, 5, 14, };
static const char* const msigs_10211497109101FrameBuffer[] = { "(iii'10211497109101RGB565')v", "(iiii)'Uint8Array'", "()v", };
static const uint16_t plist_10211497109101FrameBuffer[] = { 11, 10, 12 };
CLASS_OBJECT(class_10211497109101FrameBuffer, 3) = {
    .body = { .s = 3, .i = 1, .cn = "10211497109101FrameBuffer", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 3, .offset = 0,
    .unboxed = 1, .prop_names = plist_10211497109101FrameBuffer, .unboxed_types = "i" }, .mt = { .size = 3, .names = mnames_10211497109101FrameBuffer, .signatures = msigs_10211497109101FrameBuffer }, .vtbl = { mth_0_10211497109101FrameBuffer, mth_1_10211497109101FrameBuffer, mth_2_10211497109101FrameBuffer,  }}};

static void cons_10211497109101FrameBuffer(value_t self, value_t _background, int32_t _numOfLayers) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _background;
  {
    set_obj_property(self, 2, func_rootset.values[1]);
    set_obj_property(self, 1, gc_new_array(&array_type0.clazz, _numOfLayers, func_rootset.values[2]=new_10211497109101Layer(gc_new_object(&class_10211497109101Layer.clazz))));
    *get_obj_int_property(self, 0) = 0;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_10211497109101FrameBuffer(value_t self, value_t p0, int32_t p1) { cons_10211497109101FrameBuffer(self, p0, p1); return self; }


void mth_0_10211497109101FrameBuffer(value_t self, int32_t _x, int32_t _y, int32_t _r, value_t _color) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _color;
  {
    gc_array_set(safe_value_to_value(false, &array_type0.clazz, get_obj_property(self, 1)), *get_obj_int_property(self, 0), new_10211497109101FilledCircle(gc_new_object(&class_10211497109101FilledCircle.clazz), _x, _y, _r, func_rootset.values[1]));
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t mth_1_10211497109101FrameBuffer(value_t self, int32_t _x0, int32_t _y0, int32_t _x1, int32_t _y1) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[0] = self;
  {
    int32_t _cellNum = (_x1 - _x0 + 1) * (_y1 - _y0 + 1);
    int32_t _backgroundColor = (func_rootset.values[2] = safe_value_to_value(false, &class_10211497109101RGB565.clazz, get_obj_property(self, 2)), ((int32_t (*)(value_t))gc_method_lookup(func_rootset.values[2], 0))(func_rootset.values[2]));
    func_rootset.values[1] = gc_new_bytearray(false, _cellNum * 2, 0);
    for (
    int32_t _i = 0;_i < _cellNum; (_i)++) {
      (*gc_bytearray_get(func_rootset.values[1], _i * 2)) = _backgroundColor >> 8;
      (*gc_bytearray_get(func_rootset.values[1], _i * 2 + 1)) = _backgroundColor & 0xff;
    }
    { value_t ret_value_ = (func_rootset.values[1]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void mth_2_10211497109101FrameBuffer(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}

void bluescript_main0_10211497109101() {
  ROOT_SET_INIT(global_rootset0_10211497109101, 0)
  
  
}
