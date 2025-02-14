
#include <stdint.h>
#include "c-runtime.h"
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_();
ROOT_SET_DECL(global_rootset0, 1);

void bluescript_main0_() {
  ROOT_SET_INIT(global_rootset0, 1)
  
  set_global_variable(&global_rootset0.values[0], gc_new_bytearray(false, 3, 7));
  (*gc_bytearray_get(global_rootset0.values[0], 0)) = 13;
  
}
