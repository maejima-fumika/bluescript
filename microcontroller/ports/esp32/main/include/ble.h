#ifndef __BS_BLE__
#define __BS_BLE__

#include <stdint.h>
#include <stdbool.h>

void bs_ble_init();

#define BS_BLE_OK          0
#define BS_BLE_ERR_BUSY    (-1)  // the link is congested; sending again later may succeed
#define BS_BLE_ERR_FAILED  (-2)  // not connected, or the buffer is too large

// Queues `buffer` for sending. BS_BLE_OK does not mean the client has received it.
int bs_ble_send_buffer(uint8_t *buffer, uint32_t len);

// The largest buffer bs_ble_send_buffer can deliver over the current connection.
uint32_t bs_ble_max_send_size(void);

#endif /* __BS_BLE__ */