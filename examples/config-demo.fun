use featureset TestFeatureSet
use configset TestConfigSet

hdef functionset DemoFunctions
  name "Demo Function Set for Config Gray-out"
  description "Demonstrates config-based graying out of code blocks"
  owner "Demo Team"
  tags "demo", "config", "gray-out"

  // This function should be visible (config = 1)
  def function EnabledFunction
    name "Enabled Function"
    description "This function is enabled and should appear normal"
    ref config c_EnabledFeature
    owner "Demo Team"
    tags "enabled", "visible"

  // This function should be grayed out (config = 0)  
  def function DisabledFunction
    name "Disabled Function"
    description "This function is disabled and should be grayed out"
    ref config c_DisabledFeature
    owner "Demo Team"
    tags "disabled", "grayed-out"

    // Child elements should also be grayed out
    def function ChildFunction
      name "Child of Disabled Function"
      description "This should also be grayed out"
      ref config c_DisabledFeature 