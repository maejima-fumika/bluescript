idf_component_register(SRCS "spi.c"
                    INCLUDE_DIRS "."
                    REQUIRES core driver gpio
                    # WHOLE_ARCHIVE
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)