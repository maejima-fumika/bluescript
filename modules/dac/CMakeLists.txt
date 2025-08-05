idf_component_register(SRCS "dac.c"
                    INCLUDE_DIRS "."
                    REQUIRES core driver esp_driver_dac esp_driver_i2s esp_driver_gpio main
                    WHOLE_ARCHIVE
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)