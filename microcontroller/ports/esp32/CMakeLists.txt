# For more information about build system see
# https://docs.espressif.com/projects/esp-idf/en/latest/api-guides/build-system.html
# The following five lines of boilerplate have to be in your project's
# CMakeLists in this exact order for cmake to work correctly
cmake_minimum_required(VERSION 3.16)

set(EXTRA_COMPONENT_DIRS  
        "../../core" 
        "../../../modules/std" 
        # "../../../modules/gpio" 
        # "../../../modules/timer" 
        # "../../../modules/display"
        # "../../../modules/button"
    )

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(bluescript)

idf_build_set_property(COMPILE_OPTIONS "-Wno-maybe-uninitialized" APPEND)
