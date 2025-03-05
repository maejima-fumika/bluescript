idf_component_register(SRCS "ili9342c.c"
                    INCLUDE_DIRS "."
                    REQUIRES core driver gpio spi
                    # WHOLE_ARCHIVE
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)