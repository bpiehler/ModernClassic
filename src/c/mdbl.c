#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  ModdableCreationRecord creation = {
    .recordSize = sizeof(ModdableCreationRecord),
    .flags = kModdableCreationFlagLogInstrumentation,
  };
  moddable_createMachine(&creation);

  app_event_loop();

  window_destroy(w);
}
