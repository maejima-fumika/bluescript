
#include <stdint.h>
#include "c-runtime.h"

#include <string.h>
#include "driver/spi_master.h"

value_t new_115112105SPI(value_t self, int32_t p0, int32_t p1, int32_t p2, int32_t p3, int32_t p4, int32_t p5, int32_t p6, int32_t p7);
void mth_0_115112105SPI(value_t self, int32_t _cmd);
void mth_1_115112105SPI(value_t self, value_t _data);
value_t mth_2_115112105SPI(value_t self, int32_t _nbyte, int32_t _cmd);
extern CLASS_OBJECT(object_class, 1);
extern CLASS_OBJECT(class_103112105111GPIO, 1); extern value_t new_103112105111GPIO(value_t, int32_t, int32_t);
extern int32_t _103112105111GPIO_OUTPUT;
extern CLASS_OBJECT(class_Uint8Array, 1); extern value_t new_Uint8Array(value_t, int32_t, int32_t);
void bluescript_main0_115112105();
ROOT_SET_DECL(global_rootset0_115112105, 0);
static const uint16_t mnames_115112105SPI[] = { 11, 12, 6, };
static const char* const msigs_115112105SPI[] = { "(i)v", "('Uint8Array')v", "(ii)'Uint8Array'", };
static const uint16_t plist_115112105SPI[] = { 9, 10 };
CLASS_OBJECT(class_115112105SPI, 3) = {
    .body = { .s = 2, .i = 0, .cn = "115112105SPI", .sc = &object_class.clazz , .an = (void*)0, .pt = { .size = 2, .offset = 0,
    .unboxed = 0, .prop_names = plist_115112105SPI, .unboxed_types = "" }, .mt = { .size = 3, .names = mnames_115112105SPI, .signatures = msigs_115112105SPI }, .vtbl = { mth_0_115112105SPI, mth_1_115112105SPI, mth_2_115112105SPI,  }}};

static void cons_115112105SPI(value_t self, int32_t _baudrate, int32_t _mode, int32_t _max_transfer_size, int32_t _sck, int32_t _mosi, int32_t _miso, int32_t _cs, int32_t _dc) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    set_obj_property(self, 0, new_103112105111GPIO(gc_new_object(&class_103112105111GPIO.clazz), _dc, _103112105111GPIO_OUTPUT));
    set_obj_property(self, 1, int_to_value(0));
    
    value_t spi_device_obj = gc_new_bytearray(false, sizeof(spi_device_handle_t), 0);
    set_obj_property(self, 1, spi_device_obj);
    spi_device_handle_t* spi_device = (spi_device_handle_t*)&(value_to_ptr(spi_device_obj))->body[2];
    esp_err_t ret;
    spi_bus_config_t buscfg={
        .miso_io_num=_miso,
        .mosi_io_num=_mosi,
        .sclk_io_num=_sck,
        .quadwp_io_num=-1,
        .quadhd_io_num=-1,
        .max_transfer_sz=_max_transfer_size
    };
    spi_device_interface_config_t devcfg={
        .clock_speed_hz=_baudrate,
        .mode=_mode,
        .spics_io_num=_cs,
        .queue_size=7, 
    };
    //Initialize the SPI bus
    ret=spi_bus_initialize(HSPI_HOST, &buscfg, 2);
    ESP_ERROR_CHECK(ret);
    //Attach the LCD to the SPI bus
    ret=spi_bus_add_device(HSPI_HOST, &devcfg, spi_device);

    ESP_ERROR_CHECK(ret);;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_115112105SPI(value_t self, int32_t p0, int32_t p1, int32_t p2, int32_t p3, int32_t p4, int32_t p5, int32_t p6, int32_t p7) { cons_115112105SPI(self, p0, p1, p2, p3, p4, p5, p6, p7); return self; }


void mth_0_115112105SPI(value_t self, int32_t _cmd) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[0] = self;
  {
    (func_rootset.values[1] = safe_value_to_value(false, &class_103112105111GPIO.clazz, get_obj_property(self, 0)), ((void (*)(value_t))gc_method_lookup(func_rootset.values[1], 2))(func_rootset.values[1]));
    
    value_t spi_device_obj = get_obj_property(self, 1);
    spi_device_handle_t* spi_device = (spi_device_handle_t*)&(value_to_ptr(spi_device_obj))->body[2];
    esp_err_t ret;
    spi_transaction_t t;
    memset(&t, 0, sizeof(t));       //Zero out the transaction
    t.length=8;                     //Command is 8 bits
    t.tx_buffer=&_cmd;               //The data is the cmd itself
    ret=spi_device_polling_transmit(*spi_device, &t);  //Transmit!
    ESP_ERROR_CHECK(ret);
        ;
  }
  DELETE_ROOT_SET(func_rootset)
}

void mth_1_115112105SPI(value_t self, value_t _data) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _data;
  {
    (func_rootset.values[2] = safe_value_to_value(false, &class_103112105111GPIO.clazz, get_obj_property(self, 0)), ((void (*)(value_t))gc_method_lookup(func_rootset.values[2], 1))(func_rootset.values[2]));
    int32_t _data_len = *get_obj_int_property(func_rootset.values[1], 1);
    
    value_t spi_device_obj = get_obj_property(self, 1);
    spi_device_handle_t* spi_device = (spi_device_handle_t*)&(value_to_ptr(spi_device_obj))->body[2];
    uint8_t* data = (uint8_t*)&(value_to_ptr(func_rootset.values[1]))->body[2];
    esp_err_t ret;
    spi_transaction_t t;
    memset(&t, 0, sizeof(t));       //Zero out the transaction
    t.length=_data_len * 8;         //Len is in bytes, transaction length is in bits.
    t.tx_buffer=data;
    ret=spi_device_polling_transmit(*spi_device, &t);  //Transmit!
    ESP_ERROR_CHECK(ret);
        ;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t mth_2_115112105SPI(value_t self, int32_t _nbyte, int32_t _cmd) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = gc_new_bytearray(false, _nbyte, 0);
    
    // When using SPI_TRANS_CS_KEEP_ACTIVE, bus must be locked/acquired
    value_t spi_device_obj = get_obj_property(self, 1);
    spi_device_handle_t* spi_device = (spi_device_handle_t*)&(value_to_ptr(spi_device_obj))->body[2];
    spi_device_acquire_bus(*spi_device, portMAX_DELAY);
    ;
    (func_rootset.values[2] = safe_value_to_value(false, &class_103112105111GPIO.clazz, get_obj_property(self, 0)), ((void (*)(value_t))gc_method_lookup(func_rootset.values[2], 2))(func_rootset.values[2]));
    
    spi_transaction_t t1;
    memset(&t1, 0, sizeof(t1));       //Zero out the transaction
    t1.length=8;                     //Command is 8 bits
    t1.tx_buffer=&_cmd;               //The data is the cmd itself
    t1.flags = SPI_TRANS_CS_KEEP_ACTIVE;   //Keep CS active after data transfer
    esp_err_t ret1 = spi_device_polling_transmit(*spi_device, &t1);  //Transmit!
    ESP_ERROR_CHECK(ret1);            //Should have had no issues.
    ;
    (func_rootset.values[2] = safe_value_to_value(false, &class_103112105111GPIO.clazz, get_obj_property(self, 0)), ((void (*)(value_t))gc_method_lookup(func_rootset.values[2], 1))(func_rootset.values[2]));
    
    spi_transaction_t t2;
    memset(&t2, 0, sizeof(t2));
    t2.length=_nbyte*8;
    t2.flags = SPI_TRANS_USE_RXDATA;
    esp_err_t ret2 = spi_device_polling_transmit(*spi_device, &t2);
    ESP_ERROR_CHECK(ret2);

    // Release bus
    spi_device_release_bus(*spi_device);
    memcpy(&(value_to_ptr(spi_device_obj))->body[2], t2.rx_data, _nbyte);
        ;
    { value_t ret_value_ = (func_rootset.values[1]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void bluescript_main0_115112105() {
  ROOT_SET_INIT(global_rootset0_115112105, 0)
  
  ;
  
}
