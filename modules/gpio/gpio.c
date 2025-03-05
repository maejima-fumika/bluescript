
#include <stdint.h>
#include "c-runtime.h"

#include "driver/gpio.h"

int32_t _103112105111GPIO_INPUT;
int32_t _103112105111GPIO_OUTPUT;
int32_t _103112105111GPIO_INPUT_OUTPUT;
int32_t _103112105111GPIO_EDGE_RISING;
int32_t _103112105111GPIO_EDGE_FALLING;
int32_t _103112105111GPIO_EDGE_ANY;
value_t new_103112105111GPIO(value_t self, int32_t p0, int32_t p1);
void mth_0_103112105111GPIO(value_t self, int32_t _value);
void mth_1_103112105111GPIO(value_t self);
void mth_2_103112105111GPIO(value_t self);
int32_t mth_3_103112105111GPIO(value_t self);
void mth_4_103112105111GPIO(value_t self, int32_t _trigger, value_t _handler);
void mth_5_103112105111GPIO(value_t self);
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_103112105111();
ROOT_SET_DECL(global_rootset0_103112105111, 0);
static const uint16_t mnames_103112105111GPIO[] = { 3, 4, 5, 6, 7, 8, };
static const char* const msigs_103112105111GPIO[] = { "(i)v", "()v", "()v", "()i", "(i(i)v)v", "()v", };
static const uint16_t plist_103112105111GPIO[] = { 1, 2 };
CLASS_OBJECT(class_103112105111GPIO, 6) = {
    .body = { .s = 2, .i = 2, .cn = "103112105111GPIO", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 2, .offset = 0,
    .unboxed = 2, .prop_names = plist_103112105111GPIO, .unboxed_types = "ii" }, .mt = { .size = 6, .names = mnames_103112105111GPIO, .signatures = msigs_103112105111GPIO }, .vtbl = { mth_0_103112105111GPIO, mth_1_103112105111GPIO, mth_2_103112105111GPIO, mth_3_103112105111GPIO, mth_4_103112105111GPIO, mth_5_103112105111GPIO,  }}};

static void cons_103112105111GPIO(value_t self, int32_t _pin, int32_t _mode) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    
        if (_pin >= GPIO_NUM_MAX) {
            runtime_error("** gpio module error: pin number exceeds the maxmum number of GPIO");
        } 
        ;
    if (_mode == _103112105111GPIO_INPUT) {
      
            gpio_set_direction(_pin, GPIO_MODE_INPUT);
            ;
    }
    else 
      if (_mode == _103112105111GPIO_OUTPUT) {
        
            gpio_set_direction(_pin, GPIO_MODE_OUTPUT);
            ;
      }
      else 
        if (_mode == _103112105111GPIO_INPUT_OUTPUT) {
          
            gpio_set_direction(_pin, GPIO_MODE_INPUT_OUTPUT);
            ;
        }
        else {
          
            runtime_error("** gpio module error: unknown mode.");
            ;
        }
    *get_obj_int_property(self, 0) = _pin;
    *get_obj_int_property(self, 1) = _mode;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_103112105111GPIO(value_t self, int32_t p0, int32_t p1) { cons_103112105111GPIO(self, p0, p1); return self; }


void mth_0_103112105111GPIO(value_t self, int32_t _value) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    if (*get_obj_int_property(self, 1) != _103112105111GPIO_OUTPUT&&*get_obj_int_property(self, 1) != _103112105111GPIO_INPUT_OUTPUT) {
      
            runtime_error("** gpio module error: the gpio mode must be GPIO_OUTPUT or GPIO_INPUT_OUTPUT");
            ;
    }
    int32_t _pin = *get_obj_int_property(self, 0);
    
        gpio_set_level(_pin, _value);
        ;
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_103112105111GPIO(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    (func_rootset.values[1] = self, ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[1], 0))(func_rootset.values[1], 1));
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_2_103112105111GPIO(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    (func_rootset.values[1] = self, ((void (*)(value_t, int32_t))gc_method_lookup(func_rootset.values[1], 0))(func_rootset.values[1], 0));
  }
  DELETE_ROOT_SET(func_rootset)
}

int32_t mth_3_103112105111GPIO(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    if (*get_obj_int_property(self, 1) != _103112105111GPIO_INPUT&&*get_obj_int_property(self, 1) != _103112105111GPIO_INPUT_OUTPUT) {
      
            runtime_error("** gpio module error: the gpio mode must be GPIO_INPUT or GPIO_INPUT_OUTPUT");
            ;
    }
    int32_t _result = -1;
    int32_t _pin = *get_obj_int_property(self, 0);
    
        _result = gpio_get_level(_pin);
        ;
    { int32_t ret_value_ = (_result); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void mth_4_103112105111GPIO(value_t self, int32_t _trigger, value_t _handler) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _handler;
  {
    if (*get_obj_int_property(self, 1) != _103112105111GPIO_INPUT&&*get_obj_int_property(self, 1) != _103112105111GPIO_INPUT_OUTPUT) {
      
            runtime_error("** gpio module error: the gpio mode must be GPIO_INPUT or GPIO_INPUT_OUTPUT");
            ;
    }
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_5_103112105111GPIO(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}

void bluescript_main0_103112105111() {
  ROOT_SET_INIT(global_rootset0_103112105111, 0)
  
  ;
  _103112105111GPIO_INPUT = 0; _103112105111GPIO_INPUT = _103112105111GPIO_INPUT;
  _103112105111GPIO_OUTPUT = 1; _103112105111GPIO_OUTPUT = _103112105111GPIO_OUTPUT;
  _103112105111GPIO_INPUT_OUTPUT = 2; _103112105111GPIO_INPUT_OUTPUT = _103112105111GPIO_INPUT_OUTPUT;
  _103112105111GPIO_EDGE_RISING = 13;
  _103112105111GPIO_EDGE_FALLING = 14;
  _103112105111GPIO_EDGE_ANY = 15;
  
}
