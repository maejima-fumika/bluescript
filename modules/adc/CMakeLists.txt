idf_component_register(SRCS "adc.c"
                    INCLUDE_DIRS "."
                    REQUIRES core esp_adc main
                    WHOLE_ARCHIVE
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)