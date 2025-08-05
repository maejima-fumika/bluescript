
#include <stdint.h>
#include "c-runtime.h"

#include <string.h>
#include <stdbool.h>

#include "soc/soc_caps.h"
#include "esp_adc/adc_continuous.h"

#define CONVERSION_UNIT_SIZE 256


esp_err_t init_adc(adc_continuous_handle_t *out_handle, int32_t channel, int32_t unit, int32_t sample_freq, int32_t atten) {
    esp_err_t err = ESP_OK;
    adc_continuous_handle_t handle = NULL;
    adc_continuous_handle_cfg_t adc_config = {
        .max_store_buf_size = CONVERSION_UNIT_SIZE,
        .conv_frame_size = CONVERSION_UNIT_SIZE * 2,
    };
    err = adc_continuous_new_handle(&adc_config, &handle);
    puts("adc_continuous_new_handle");
    ESP_ERROR_CHECK(err);
    if (err != ESP_OK) {
        return err;
    }
    adc_continuous_config_t dig_cfg = {
        .sample_freq_hz = (uint32_t)sample_freq,
        .conv_mode = ADC_CONV_SINGLE_UNIT_1,
        .format = ADC_DIGI_OUTPUT_FORMAT_TYPE1,
    };

    adc_digi_pattern_config_t adc_pattern[1] = {0};
    dig_cfg.pattern_num = 1;
    adc_pattern[0].atten = (adc_atten_t)atten;
    adc_pattern[0].channel = (uint8_t)channel;
    adc_pattern[0].unit = (uint8_t)unit;
    adc_pattern[0].bit_width = SOC_ADC_DIGI_MAX_BITWIDTH;

    dig_cfg.adc_pattern = adc_pattern;
    err = adc_continuous_config(handle, &dig_cfg);
    puts("adc_continuous_config");
    ESP_ERROR_CHECK(err);
    if (err != ESP_OK) {
        return err;
    }
    memcpy(out_handle, &handle, sizeof(adc_continuous_handle_t));
    return ESP_OK;
}


static bool IRAM_ATTR call_cb_function(adc_continuous_handle_t handle, const adc_continuous_evt_data_t *edata, void* arg) {
    ((void (*)(value_t))gc_function_object_ptr((value_t)arg, 0))(get_obj_property((value_t)arg, 2));
    return true;
}

extern struct func_body fn_000005_0_0;
static void cons_000005ADC(value_t self, int32_t _channel, int32_t _unit, int32_t _sampleFreqHz, float _attenuation);
value_t new_000005ADC(value_t self, int32_t p0, int32_t p1, int32_t p2, float p3);
int32_t mth_0_000005ADC(value_t self);
int32_t mth_1_000005ADC(value_t self);
int32_t mth_2_000005ADC(value_t self);
int32_t mth_3_000005ADC(value_t self);
int32_t mth_4_000005ADC(value_t self, value_t _cb);
value_t mth_5_000005ADC(value_t self);
int32_t _000005ADC_SUCCESS;
int32_t _000005ADC_FAIL;

int32_t esp_err_to_adc_int(esp_err_t err) {
    if (err == ESP_OK) {
        return _000005ADC_SUCCESS;
    } else {
        return _000005ADC_FAIL;
    }
}

extern CLASS_OBJECT(object_class, 1);
extern CLASS_OBJECT(class_Uint8Array, 1); extern value_t new_Uint8Array(value_t, int32_t, int32_t);
void bluescript_main0_000005();
ROOT_SET_DECL(global_rootset0_000005, 0);
static const uint16_t mnames_000005ADC[] = { 15, 16, 17, 18, 19, 20, };
static const char* const msigs_000005ADC[] = { "()i", "()i", "()i", "()i", "(()v)i", "()'Uint8Array'", };
static const uint16_t plist_000005ADC[] = { 9, 10, 11, 12, 13, 8, 14 };
CLASS_OBJECT(class_000005ADC, 6) = {
    .body = { .s = 7, .i = 5, .cn = "000005ADC", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 7, .offset = 0,
    .unboxed = 5, .prop_names = plist_000005ADC, .unboxed_types = "iiiib" }, .mt = { .size = 6, .names = mnames_000005ADC, .signatures = msigs_000005ADC }, .vtbl = { mth_0_000005ADC, mth_1_000005ADC, mth_2_000005ADC, mth_3_000005ADC, mth_4_000005ADC, mth_5_000005ADC,  }}};

static void fbodyfn_000005_0_0(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body fn_000005_0_0 = { fbodyfn_000005_0_0, "()v" };

static void cons_000005ADC(value_t self, int32_t _channel, int32_t _unit, int32_t _sampleFreqHz, float _attenuation) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 1) = _unit;
    *get_obj_int_property(self, 0) = _channel;
    
    if (SOC_ADC_SAMPLE_FREQ_THRES_HIGH < _sampleFreqHz) {
        runtime_error("** ADC module error: sampleFreq is larger than maxmum number of sample freq");
    }
    if (SOC_ADC_SAMPLE_FREQ_THRES_LOW > _sampleFreqHz) {
        runtime_error("** ADC module error: sampleFreq is smaller than minimum number of sample freq");
    }
        ;
    *get_obj_int_property(self, 2) = _sampleFreqHz;
    int32_t _atten = -1;
    
    if (_attenuation == 0.0) {
        _atten = ADC_ATTEN_DB_0;
    } else if (_attenuation == 2.5) {
        _atten = ADC_ATTEN_DB_2_5;
    } else if (_attenuation == 6.0) {
        _atten = ADC_ATTEN_DB_6;
    } else if (_attenuation == 12) {
        _atten = ADC_ATTEN_DB_12;
    } else {
        runtime_error("** ADC module error: the specified attenuation is not available. Available attenuations are 0, 2.5, 6, 12, 11");
    }
        ;
    *get_obj_int_property(self, 3) = _atten;
    int32_t _handleSize = 0;
    _handleSize = sizeof(adc_continuous_handle_t);;
    *get_obj_int_property(self, 4) = 0;
    set_obj_property(self, 5, gc_new_bytearray(false, _handleSize, 0));
    set_obj_property(self, 6, gc_new_function(fn_000005_0_0.fptr, fn_000005_0_0.signature, VALUE_UNDEF));
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_000005ADC(value_t self, int32_t p0, int32_t p1, int32_t p2, float p3) { cons_000005ADC(self, p0, p1, p2, p3); return self; }


int32_t mth_0_000005ADC(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 5));
    int32_t _channel = *get_obj_int_property(self, 0);
    int32_t _unit = *get_obj_int_property(self, 1);
    int32_t _sampleFreq = *get_obj_int_property(self, 2);
    int32_t _atten = *get_obj_int_property(self, 3);
    
    value_t _handle = func_rootset.values[1];
    adc_continuous_handle_t* handle_ptr = (adc_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    esp_err_t err = init_adc(handle_ptr, _channel, _unit, _sampleFreq, _atten);
    if (err != ESP_OK) {
        return esp_err_to_adc_int(err);
    }
        ;
    set_obj_property(self, 5, func_rootset.values[1]);
    *get_obj_int_property(self, 4) = !0;
    { int32_t ret_value_ = (_000005ADC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

int32_t mth_1_000005ADC(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 5));
    
    value_t _handle = func_rootset.values[1];
    adc_continuous_handle_t* handle_ptr = (adc_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    esp_err_t err = ESP_OK;
    err = adc_continuous_stop(*handle_ptr);
    if (err != ESP_OK) {
        return esp_err_to_adc_int(err);
    }
    err = adc_continuous_deinit(*handle_ptr);
    if (err != ESP_OK) {
        return esp_err_to_adc_int(err);
    }
        ;
    *get_obj_int_property(self, 4) = 0;
    { int32_t ret_value_ = (_000005ADC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

int32_t mth_2_000005ADC(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 5));
    
    value_t _handle = func_rootset.values[1];
    adc_continuous_handle_t* handle_ptr = (adc_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    esp_err_t err = adc_continuous_start(*handle_ptr);
    if (err != ESP_OK) {
        return esp_err_to_adc_int(err);
    }
        ;
    { int32_t ret_value_ = (_000005ADC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

int32_t mth_3_000005ADC(value_t self) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 5));
    
    value_t _handle = func_rootset.values[1];
    adc_continuous_handle_t* handle_ptr = (adc_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    esp_err_t err = adc_continuous_stop(*handle_ptr);
    if (err != ESP_OK) {
        return esp_err_to_adc_int(err);
    }
        ;
    { int32_t ret_value_ = (_000005ADC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

int32_t mth_4_000005ADC(value_t self, value_t _cb) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _cb;
  {
    func_rootset.values[2] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 5));
    
    value_t _handle = func_rootset.values[2];
    adc_continuous_handle_t* handle_ptr = (adc_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    adc_continuous_evt_cbs_t cbs = {
        .on_conv_done = call_cb_function,
    };
    esp_err_t err = adc_continuous_register_event_callbacks(*handle_ptr, &cbs, (void*)_cb);
    if (err != ESP_OK) {
        return esp_err_to_adc_int(err);
    }
        ;
    set_obj_property(self, 6, func_rootset.values[1]);
    { int32_t ret_value_ = (_000005ADC_SUCCESS); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

value_t mth_5_000005ADC(value_t self) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = safe_value_to_value(false, &class_Uint8Array.clazz, get_obj_property(self, 5));
    int32_t _resultSize = 0;
    _resultSize = CONVERSION_UNIT_SIZE;
    func_rootset.values[2] = gc_new_bytearray(false, _resultSize, 0);
    
    value_t _handle = func_rootset.values[1];
    value_t _result = func_rootset.values[2];
    uint8_t *result_ptr = (uint8_t*)&(value_to_ptr(_result))->body[2];;
    uint32_t out_length = 0;
    adc_continuous_handle_t* handle_ptr = (adc_continuous_handle_t*)&(value_to_ptr(_handle))->body[2];
    adc_continuous_read(*handle_ptr, result_ptr, CONVERSION_UNIT_SIZE, &out_length, 0);
        ;
    { value_t ret_value_ = (func_rootset.values[2]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void bluescript_main0_000005() {
  ROOT_SET_INIT(global_rootset0_000005, 0)
  
  ;
  ;
  ;
  _000005ADC_SUCCESS = 0; _000005ADC_SUCCESS = _000005ADC_SUCCESS;
  _000005ADC_FAIL = 1;
  ;
  
}
