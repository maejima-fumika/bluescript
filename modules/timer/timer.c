
#include <stdint.h>
#include "c-runtime.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

extern struct func_body _116105109101114waitMs;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_116105109101114();
ROOT_SET_DECL(global_rootset0_116105109101114, 0);

void fbody_116105109101114waitMs(value_t self, int32_t _ms) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    
   vTaskDelay(_ms / portTICK_PERIOD_MS);
   ;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _116105109101114waitMs = { fbody_116105109101114waitMs, "(i)v" };

void bluescript_main0_116105109101114() {
  ROOT_SET_INIT(global_rootset0_116105109101114, 0)
  
  ;
  
}
