
#include <stdint.h>
#include "c-runtime.h"

#include "driver/dac_continuous.h"


esp_err_t init_dac(dac_continuous_handle_t *handle, int32_t channel, int32_t freq) {
    dac_continuous_config_t cont_cfg = {
        .chan_mask = (dac_channel_mask_t) channel,
        .desc_num = 4,
        .buf_size = 2048, 
        .freq_hz = (uint32_t) freq,
        .clk_src = DAC_DIGI_CLK_SRC_APLL, 
        .offset = 0,
        .chan_mode = DAC_CHANNEL_MODE_SIMUL, 
    };

    esp_err_t err = dac_continuous_new_channels(&cont_cfg, handle);
    if (err != ESP_OK) {
        return err;
    }
    err = dac_continuous_enable(*handle);
    return err;
}

esp_err_t deinit_dac(dac_continuous_handle_t *handle) {
    esp_err_t err = dac_continuous_disable(*handle);
    if (err != ESP_OK) {
        return err;
    }
    err = dac_continuous_del_channels(*handle);
    return err;
}

int32_t esp_err_to_dac_int(esp_err_t err);

static void cons_000006DAC(value_t self, int32_t _pin, int32_t _freqHz);
value_t new_000006DAC(value_t self, int32_t p0, int32_t p1);
int32_t mth_0_000006DAC(value_t self);
int32_t mth_1_000006DAC(value_t self);
int32_t mth_2_000006DAC(value_t self, value_t _buf);
int32_t _000006DAC_SUCCESS;
int32_t _000006DAC_FAIL;

int32_t esp_err_to_dac_int(esp_err_t err) {
    if (err == ESP_OK) {
        return _000006DAC_SUCCESS;
    } else {
        return _000006DAC_FAIL;
    }
}

extern CLASS_OBJECT(object_class, 1);
extern CLASS_OBJECT(class_Uint8Array, 1); extern value_t new_Uint8Array(value_t, int32_t, int32_t);
extern struct func_body _print;
extern void fbody_print(value_t self, value_t p0);
void bluescript_main0_000006();
ROOT_SET_DECL(global_rootset0_000006, 0);
static const uint16_t mnames_000006DAC[] = { 12, 13, 14, };
static const char* const msigs_000006DAC[] = { "()i", "()i", "('Uint8Array')i", };
static const uint16_t plist_000006DAC[] = { 9, 10, 11, 8 };
CLASS_OBJECT(class_000006DAC, 3) = {
    .body = { .s = 4, .i = 3, .cn = "000006DAC", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 4, .offset = 0,
    .unboxed = 3, .prop_names = plist_000006DAC, .unboxed_types = "iib" }, .mt = { .size = 3, .names = mnames_000006DAC, .signatures = msigs_000006DAC }, .vtbl = { mth_0_000006DAC, mth_1_000006DAC, mth_2_000006DAC,  }}};

static void cons_000006DAC(value_t self, int32_t _pin, int32_t _freqHz) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    int32_t _channel = -1;
    if (_pin == 25) {
      _channel = (int32_t)DAC_CHANNEL_MASK_CH0;
    }
    else 
      if (_pin == 26) {
        _channel = (int32_t)DAC_CHANNEL_MASK_CH1;
      }
      else {
        runtime_error("** DAC module error: invalid pin. The pin should be 25 or 26");;
      }
    *get_obj_int_property(self, 0) = _channel;
    int32_t _minFreq = 19600;
    if (_freqHz < _minFreq) {
      runtime_error("** DAC module error: invalid freq. The freq should be larger than 19600.");;
    }
    *get_obj_int_property(self, 1) = _freqHz;
    int32_t _handleSize = 0;
    _handleSize = sizeof(dac_continuous_handle_t);;
    *get_obj_int_property(self, 2) = 0;
    set_obj_property(self, 3, gc_new_bytearray(false, _handleSize, 0));
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_000006DAC(value_t self, int32_t p0, int32_t p1) { cons_000006DAC(self, p0, p1); return self; }


int32_t mth_0_000006DAC(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 3));
    int32_t _channel = *get_obj_int_property(self, 0);
    int32_t _freq = *get_obj_int_property(self, 1);
    
    value_t _handle = func_rootset.values[1];
    dac_continuous_handle_t* handle_ptr = (dac_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    esp_err_t err = init_dac(handle_ptr, _channel, _freq);
    if (err != ESP_OK) {
        return esp_err_to_dac_int(err);
    }
        ;
    *get_obj_int_property(self, 2) = !0;
    { int32_t ret_value_ = (_000006DAC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

int32_t mth_1_000006DAC(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 3));
    
    value_t _handle = func_rootset.values[1];
    dac_continuous_handle_t* handle_ptr = (dac_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    esp_err_t err = deinit_dac(handle_ptr);
    return esp_err_to_dac_int(err);
    if (err != ESP_OK) {
        return esp_err_to_dac_int(err);
    }
        ;
    *get_obj_int_property(self, 2) = 0;
    { int32_t ret_value_ = (_000006DAC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

int32_t mth_2_000006DAC(value_t self, value_t _buf) {
  ROOT_SET(func_rootset,4)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _buf;
  {
    if (!*get_obj_int_property(self, 2)) {
      fbody_print(0, func_rootset.values[3]=(gc_new_string("DAC module warning: DAC is not activated.")));
      { int32_t ret_value_ = (_000006DAC_FAIL); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    func_rootset.values[2] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 3));
    int32_t _bufSize = *get_obj_int_property(func_rootset.values[1], 1);
    
    value_t _handle = func_rootset.values[2];
    dac_continuous_handle_t* handle_ptr = (dac_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    uint8_t* buf_ptr = (uint8_t*)&(value_to_ptr(_buf))->body[2];
    esp_err_t err = dac_continuous_write(*handle_ptr, buf_ptr, (size_t)_bufSize, NULL, -1);
    return esp_err_to_dac_int(err);
        ;
    { int32_t ret_value_ = (_000006DAC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void bluescript_main0_000006() {
  ROOT_SET_INIT(global_rootset0_000006, 0)
  
  ;
  ;
  _000006DAC_SUCCESS = -1; _000006DAC_SUCCESS = _000006DAC_SUCCESS;
  _000006DAC_FAIL = -1; _000006DAC_FAIL = _000006DAC_FAIL;
  ;
  
}
