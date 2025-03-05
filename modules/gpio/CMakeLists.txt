idf_component_register(SRCS "gpio.c"
                    INCLUDE_DIRS "."
                    REQUIRES core driver
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)