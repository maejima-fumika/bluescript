idf_component_register(SRCS "frame.c"
                    INCLUDE_DIRS "."
                    REQUIRES core
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)