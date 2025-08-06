# Sylang Language Specification

**You are an AI specialist in Systems Engineering, Model-Based Systems Engineering (MBSE), Digital Twin development, and Safety-Critical System Design. You have expertise in creating VSCode language extensions, cross-file validation, symbol management, and feature model architectures for complex automotive, aerospace, medical, and industrial systems.**

## Sylang - a slang or domain specific language for Model Based Systems Engineering and Digital Twin language. Many introduce AI in the existing tools as a patch for creating AI based solutions. I believe strongly what Andrej Karpathy mentioned once - AI is the creator and human is the validator. Based on that motto, Sylang and related tools were created for AI to assist them in creating artifacts for systems development that satisfies not only a generic system design, but also scalable complex safety critical systems for the industries such as Automotive, Aerospace, Medical, Industrial etc., Of course, the tailored version can be used in general PC/Web based software solution as well.

## Tool for the language
### The language is defined independently, but a vscode extension is created to integrate the language syntaxex/errors/structure to ease the AI work or human validation of the AI created work. If the vscode extension of installed, the following structure is automatically enforced, to have a clean use of this language.

## General language design
### Sylang language is represented by various file extensions to differentiate the purpose and focus of the file serving the entire project. It is recommeneded to have a certain folder structure as well, but not enforced. Users are allowed to create whatever the folder strcuture they feel is good for them. But the parent directory needs to have this file called ".sylangrules". Once it finds this file, it considers that as the parent directory, and everything else is a sub-directory, so that it can search for symbols used in that project. Sylang language shall never use begin, end kind of keywords or any other braces, brackets etc. The language uses indentation to differenatite the structure. Single line comments are provided by `//` and multi-line comments are provided by `/*  */`. Properties and relation keywords do not follow a 

### Sylang currently serves the following files extensions with mainly 4 categories

> **📋 Current Implementation Status (v2.0.2)**
> 
> **✅ FULLY IMPLEMENTED (7 extensions):**
> - **Product Line Management**: `.ple`, `.fml`, `.vml`, `.vcf`
> - **Systems Engineering**: `.blk`, `.fun`, `.req`, `.tst`
> 
> **🚧 PLANNED FOR FUTURE VERSIONS:**
> - **Systems Analysis**: `.fma`, `.fmc`, `.fta` 
> - **Safety Analysis**: `.itm`, `.haz`, `.rsk`, `.sgl`
> - **General Definitions**: `.enm`
> 
> The current VSCode extension fully supports cross-file validation, symbol management, configuration-based graying, and all advanced features for the 7 implemented file types.

#### sylang-productline
| Filename | Description | General rule |
|-----------|---------|----------|
| .ple | Product Line  | Only one .ple allowed in a project |
| .fml | Feature Model | Only one .fml allowed in a project |
| .vml | Variant Model | This is derived from .fml, multiple .vml allowed in a project|
| .vcf | Variant Config | This is generated from .vml using a predefined command, only one allowed, if there is an existing one, taht will be deleted to create a new .vcf|
#### sylang-systemseng
| Filename | Description | General rule |
|-----------|---------|----------|
| .blk | Block  | Multiple block files allowed, this represents a block at any heirachial development of systems.|
| .fun | Function Group | Multiple function files allowed at various levels|
| .req | Requirement Section | Multiple function files allowed at various levels|
| .tst | Test Suite | Multiple function files allowed at various levels|
#### sylang-systemsanalysis
| Filename | Description | General rule |
|-----------|---------|----------|
| .fma | Failure Mode Analysis  | Only one per folder allowed |
| .fmc | Failure Mode Controls | Only one per folder allowed |
| .fta | Fault Tree Analysis | Only one per folder allowed |
#### sylang-safetyanalysis
| Filename | Description | General rule |
|-----------|---------|----------|
| .itm | Item Definition  | Only one per folder allowed |
| .haz | Hazard Analysis | Only one per folder allowed |
| .rsk | Risk Assessment | Only one per folder allowed |
| .sgl | Safety Goal Definition| Only one per folder allowed |
#### sylang-general
| Filename | Description | General rule |
|-----------|---------|----------|
| .enm | Enum Definition  | multiple files allowed at various levels |


### Sylang general grammar definition
#### **Keywords** are already defined for the grammar. Any keywords outside of the list should throw an error. Also, for every file extension, only certain keywords are allowed. There are different types of keywords - imports, header definitions, definitions, references, properties and relations. Below you will find more details on it.
#### **Indentation** The language follows strict indentation. Every 2 spaces or a tab represents one level further. Parent-child relationships are therefore defined through this indentation levels.
#### **Generic Grammar Structure**
```
use <header-def-keyword> <header-identifier>  //multiple `use` keyword allowed
use <header-def-keyword> <header-identifier1>, <header-identifier2>, <header-identifer3> //multiple identifiers in a `use` keyword allowed

hdef <header-def-keyword> <header-identifier>  //hdef is mandatory, one only hdef allowed. only `use` statement is allowed prior to hdef, no other keyword statement are allowed. sdef, def and its properties and relations are only allowed under hdef.
  <property-keyword> "string literal"     // multiple properties allowed, and multple string literal per line allowed
  <property-keyword> enum <enum-identifier>   // multiple properties with enum allowed, but only one enum for a property, because it is an enum.
  <relation-keyword> ref <def-keyword/header-def-keyword> <def-identifier/header-def-identifier> //Optional, multiple relation statements allowed

  def <def-keyword> <def-identifier> <optional-flag> //def is optional - multiple def is allowed - nested def code blocks are allowed, parent-child relation between def is based on indentation levels; optional-flag is specified specially for any extension
    <property-keyword> "string literal"     // multiple properties allowed, and multple string literal per line allowed
    <property-keyword> <pre-defined-enum>   // multiple properties with enum allowed, but only one enum for a property, because it is an enum.
    <relation-keyword> ref <def-keyword/header-def-keyword> <def-identifier/header-def-identifier> // multiple relation statements allowed, with multiple identifiers of the same def-keyword allowed

    def <def-keyword> <def-identifier> <optional-flag> //def is optional - multiple def is allowed - nested def code blocks are allowed, parent-child relation between def is based on indentation levels; optional-flag is specified specially for any extension
      <property-keyword> "string literal"     // multiple properties allowed, and multple string literal per line allowed
      <property-keyword> <pre-defined-enum>   // multiple properties with enum allowed, but only one enum for a property, because it is an enum.
      <relation-keyword> ref <def-keyword/header-def-keyword> <def-identifier/header-def-identifier> // multiple relation statements allowed, with multiple identifiers of the same def-keyword allowed

  def <def-keyword> <def-identifier> <optional-flag> //def is optional - multiple def is allowed - nested def code blocks are allowed, parent-child relation between def is based on indentation levels; optional-flag is specified specially for any extension
    <property-keyword> "string literal"     // multiple properties allowed, and multple string literal per line allowed
    <property-keyword> <pre-defined-enum>   // multiple properties with enum allowed, but only one enum for a property, because it is an enum.
    <relation-keyword> ref <def-keyword/header-def-keyword> <def-identifier/header-def-identifier> // multiple relation statements allowed, with multiple identifiers of the same def-keyword allowed

```

##### **Exceptions**
###### `.ple` files do not use `use` keyword/statement. It is allowed in that, because .ple is the root of everything. It cannot import anything.

#### **.ple file structure**

###### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| productline | <header-def-keyword> |
| name | <property> |
| description | <property> |
| owner | <property> |
| domain | <property> |
| compliance | <property> |
| firstrelease | <property> |
| tags | <property> |
| safetylevel | <enum> |
| region | <property> |

###### **Sample code**
```
hdef productline BloodPressureProductLine
  name "dfdjdjddd"
  description "Comprehensive digital blood pressure monitoring system for home and clinical use"
  owner "Medical Device Engineering Team"
  domain "medical-devices", "health-monitoring", "connected-health"
  compliance "ISO 14971", "IEC 62304", "ISO 13485", "FDA 21 CFR 820", "EU MDR", "IEC 62366-1", "ISO 27001"
  firstrelease "2025-06-01"
  tags "blood-pressure", "sphygmomanometer", "digital-health", "WiFi", "telemedicine"
  safetylevel ASIL-C
  region "Global", "North America", "Europe", "Asia-Pacific", "Latin America"
```

###### **Validation and error handling**
###### - Product Line file (.ple) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - `use` keyword/statement is not allowed in .ple file. 
###### - Only one .ple file allowed in a project. 
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

#### **.fml file structure**
###### Nested definitions allowed. Parent-child symbol relationships are calculated based on indentation.

###### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| featureset | <header-def-keyword> |
| listedfor | <relation-keyword> |
| name | <property> |
| description | <property> |
| owner | <property> |
| tags | <property> |
| safetylevel | <enum> |
| def | definition|
| feature | <def-keyword> |
| mandatory | <optional-flag> |
| optional | <optional-flag> |
| or | <optional-flag> |
| alternative | <optional-flag> |

###### **Sample code**
```
use productline BloodPressureProductLine

hdef featureset BloodPressureFeatures
  name "Blood Pressure Monitoring Feature Set"
  description "Complete feature model for digital blood pressure monitoring system"
  owner "Product Engineering Team"
  tags "features", "blood-pressure", "medical-device", "connectivity"
  listedfor productline BloodPressureProductLine

  def feature BloodPressureMeasurement mandatory
    name "Core Blood Pressure Measurement"
    description "Primary blood pressure measurement functionality"
    owner "Biomedical Engineering Team"
    tags "measurement", "core-function", "safety-critical"
    safetylevel ASIL-C
    requires feature UserInterface

    def feature AutomaticMeasurement mandatory
      name "Automatic Measurement Function"
      description "Automated blood pressure measurement with cuff inflation"
      owner "Measurement Engineering Team"
      tags "automatic", "measurement", "inflation"
      safetylevel ASIL-C

      //.... multiple nested defs allowed
```

###### **Allowed properties for feautureset**
####### name, description, owner, tags, listedfor - are the only allowed proeprties of a featureset.

###### **Allowed properties for feauture**
####### name, description, owner, tags, safetylevel - are the allowed proeprties of a featureset.
####### requires, excludes are optionally allowed proeprties of a featureset.

###### **Validation and error handling**
###### - Feature model file (.ple) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - Only one .vml file allowed in a project. 
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

###### **Special .fml validation**
####### - Parent-child features can be any. But it strictly shall follow siblings rule. Parent-child is decided by indentation levels. Siblings are the ones at the same indent level for the same parent. Different parent siblings are not considered for this rule.
####### - If one sibling is mandatory or optional, every other sibling shall be mandatory or optional only. 
####### - If one sibling is or, every other sibling shall be or only. 
####### - If one sibling is alternative, every other sibling shall be alternative only. 

#### **.vml file structure**
##### Nested definitions allowed. Parent-child symbol relationships are calculated based on indentation. .vml files can be generated through a command. Right click .vml file - `Create .vml template`.

##### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| variantset | <header-def-keyword> |
| name | <property> |
| description | <property> |
| owner | <property> |
| tags | <property> |
| ref | reference |
| feature | <def-keyword> |
| extends | <relation-keyword> |
| mandatory | <optional-flag> |
| optional | <optional-flag> |
| or | <optional-flag> |
| alternative | <optional-flag> |
| selected | <optional-flag> |

##### **Sample code**
```
use featureset BloodPressureFeatures

hdef variantmodel BloodPressureVariants
  name "Blood Pressure Monitoring Variant Model"
  description "Configuration variants for blood pressure monitoring product family"
  owner "Product Line Engineering"
  tags "variants", "configuration", "product-family", "WiFi"

  // Core System Features (mandatory and selected)
  extends ref feature BloodPressureMeasurement mandatory selected
    extends ref feature AutomaticMeasurement mandatory selected
    extends ref feature ManualMeasurement optional
    extends ref feature ContinuousMeasurement optional
    extends ref feature MeasurementAccuracy mandatory selected

  extends ref feature DataManagement mandatory selected
    extends ref feature LocalStorage mandatory selected
    extends ref feature CloudSync optional selected
    extends ref feature DataEncryption mandatory selected
    extends ref feature PatientProfiles mandatory selected

  extends ref feature ConnectivityFeatures mandatory selected
    extends ref feature WiFiConnectivity mandatory selected
    extends ref feature BluetoothConnectivity optional selected
    extends ref feature EthernetConnectivity optional

      //.... multiple nested refs allowed
```

##### **Validation and error handling**
###### - Variant model file (.vml) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - multiple .vml file allowed in a project. 
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

##### **Special .vml rules**
###### - use the same format of .fml file, but selected keyword tells us whether a feature is selected for this variant.

##### **VML Selection Validation Rules**

**Basic extends relation structure:**
```
extends ref feature <feature-identifier> <optional-flag> [selected]
```

**Selection Rules Based on Optional Flags:**

1. **mandatory features:**
   - **MUST be selected** when parent is selected
   - If parent selected but mandatory child not selected → **ERROR**

2. **optional features:**
   - Can be `selected` or not selected (no constraints)
   - `optional selected` or `optional` (both valid)

3. **alternative siblings:**
   - **Only ONE** can be selected among siblings
   - If multiple `alternative` siblings have `selected` → **ERROR**
   - Zero selected is allowed

4. **or siblings:**
   - **At least ONE** must be selected among siblings  
   - If zero `or` siblings have `selected` → **ERROR**
   - Multiple selected is allowed

**Parent Dependency (Critical):**
**Validation only applies when the parent feature is selected:**
- **Parent NOT selected** → Children validation skipped (irrelevant for variant)
- **Parent IS selected** → Enforce ALL selection rules for children:
  - **mandatory**: must be selected
  - **alternative**: only one selected
  - **or**: at least one selected
  - **optional**: no constraints

**Examples:**
```
# ✅ Valid: Parent selected, one alternative chosen
extends ref feature PowerManagement mandatory selected
  extends ref feature BatteryPower alternative selected
  extends ref feature ACPower alternative

# ✅ Valid: Parent selected, or siblings properly selected  
extends ref feature SecurityFeatures mandatory selected
  extends ref feature UserAuth or selected
  extends ref feature SecureComm or selected

# ❌ Invalid: Multiple alternatives selected
extends ref feature Algorithms mandatory selected
  extends ref feature Algorithm1 alternative selected
  extends ref feature Algorithm2 alternative selected

# ❌ Invalid: No 'or' siblings selected when parent is selected
extends ref feature ConnectivityFeatures mandatory selected
  extends ref feature WiFi or
  extends ref feature Bluetooth or

# ❌ Invalid: Mandatory child not selected when parent is selected
extends ref feature DataManagement mandatory selected
  extends ref feature LocalStorage mandatory              ← ERROR: Must be selected
  extends ref feature CloudSync optional selected

# ✅ Valid: Parent not selected, children validation skipped
extends ref feature AdvancedFeatures optional
  extends ref feature Feature1 alternative selected
  extends ref feature Feature2 alternative selected
```

#### **.vcf file structure**
##### .vcf files are auto-generated through a command. Right click .vcf file - `Generate variant config (.vcf)`. Only one .vcf per project is allowed. If there is already an existing .vcf file, then provide a prompt to delete that file to replace it with a new file. If there are two .vcf file, make sure to provide error in the console.

##### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| configset | <header-def-keyword> |
| generatedfrom | <relation-keyword> |
| generatedat | <property> |
| name | <property> |
| description | <property> |
| owner | <property> |
| tags | <property> |
| def | definition |
| config | <config-keyword> |

##### **Sample code**
```
use variantmodel BloodPressureVariants

hdef configset BloodPressureVariantsConfigs
    name "BloodPressureVariants Configuration Set"
    description "Auto-generated configuration from BloodPressureVariantModel.vml variant model selections"
    owner "Product Engineering"
    generatedfrom variantmodel BloodPressureVariants
    generated "2025-07-19T22:21:11.432Z"
    tags "variant", "config", "auto-generated"

    def config c_BloodPressureMeasurement 1
    def config c_BloodPressureMeasurement_AutomaticMeasurement 1
    def config c_BloodPressureMeasurement_ContinuousMeasurement 0
    def config c_BloodPressureMeasurement_ManualMeasurement 0
    def config c_BloodPressureMeasurement_MeasurementAccuracy 1
    def config c_ConnectivityFeatures 1
    def config c_ConnectivityFeatures_BluetoothConnectivity 1
    def config c_ConnectivityFeatures_EthernetConnectivity 0
    def config c_ConnectivityFeatures_WiFiConnectivity 1
    def config c_DataManagement 1
    def config c_DataManagement_CloudSync 1
    def config c_DataManagement_DataEncryption 1
    def config c_DataManagement_LocalStorage 1
    def config c_DataManagement_PatientProfiles 1
    def config c_PowerManagement 1

      //.... multiple def configs allowed based on teh variant model it derives from
```

##### **Validation and error handling**
###### - Variant config file (.vcf) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - only one .vcf file allowed in a project.
###### - all the defs are at the same indent level. But the name of the config adds its children with an underscore - see sample code for exampls. 
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

#### **.fun file structure**
##### Functions are defined by .fun files. .fun files can be multiple, and it can be multiple under a folder and in various folders. 

##### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| functionset | <header-def-keyword> |
| name | <property> |
| description | <property> |
| owner | <property> |
| tags | <property> |
| safetylevel | <enum> |
| def | definition|
| function | <def-keyword> |
| enables | <relation-keyword> |
| feature | <relation-def-keyword> |
| allocatedto | <relation-keyword> |
| block | <relation-def-keyword> |
| ref | reference |
| config | <config-keyword> |


##### **Sample code**
```
use featureset BloodPressureFeatures
use configset BloodPressureVariantsConfigs
use block MeasurementSubsystem

hdef functionset BloodPressureFunctions
  name "Inflate Cuff Function"
  config c_AdvancedAlgorithms_PredictiveAnalytics
  description "Controls pneumatic cuff inflation to specified pressure"
  owner "Measurement Engineering"
  tags "variant", "config", "auto-generated"

  // Core Measurement Functions
  def function InflateCuff
    name "Inflate Cuff Function"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    description "Controls pneumatic cuff inflation to specified pressure"
    owner "Measurement Engineering"
    tags "variant", "config", "auto-generated"
    safetylevel ASIL-C
    enables ref feature AutomaticMeasuremt
    allocatedto ref subsystem Measuremenbsystem

  def function DeflateCuff
    name "Deflate Cuff Function"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    description "Controls pneumatic cuff deflation at specified rate"
    owner "Measurement Engineering"
    safetylevel ASIL-C
    enables ref feature AutomaticMeasurement
    allocatedto ref subsystem MeasurementSubsystem

  //.... multiple function definitions allowed

```

##### **Allowed properties for fucntionset**
###### name, description, config, owner, tags - are the only allowed properties of a fucntionset.

##### **Allowed properties for function**
###### name, description, owner, tags, safetylevel - are the allowed properties of a function.
###### enables, allocatedto are optionally allowed relation properties of a function.

##### **Validation and error handling**
###### - function file (.fun) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - multiple .fun files allowed in a project.
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

#### **.req file structure**
##### Requirements are defined by .req files. .req files can be multiple, and it can be multiple under a folder and in various folders. 

##### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| reqset | <header-def-keyword> |
| name | <property> |
| description | <property> |
| owner | <property> |
| tags | <property> |
| safetylevel | <enum> |
| def | definition|
| requirement | <def-keyword> |
| refinedfrom | <relation-keyword> |
| derivedfrom | <relation-keyword> |
| requirement | <relation-def-keyword> |
| implements | <relation-keyword> |
| function | <relation-def-keyword> |
| allocatedto | <relation-keyword> |
| block | <relation-def-keyword> |
| ref | reference |
| config | <config-keyword> |
| rationale | <property> |
| verificationcriteria | <property> |
| status | <enum> |
| reqtype | <enum> |


##### **Sample code**
```
use functiongroup BloodPressureFunction
use block MeasurementSubsystem
use configset BloodPressureVariantsConfigs

hdef reqset BloodPressureSystemRequirements
  name "Blood Pressure Monitoring System Requirements Specification"
  description "Complete requirements for WiFi-enabled clinical blood pressure monitoring system"
  owner "blah balc"
  tags "hdjsfnd", "dfkandkfgv"
  ref config c_AdvancedAlgorithms_PredictiveAnalytics
  
  def requirement REQ_MEAS_001
    name "Blood Pressure Measurement Accuracy"
    description "WHEN performing blood pressure measurement THE system SHALL provide systolic and diastolic readings accurate to ±3 mmHg"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    reqtype enum system
    derivedfrom ref requirement MedicalDeviceStandards, ClinicalAccuracyStandards
    allocatedto ref block MeasurementSubsystem
    implements ref function DeflateCuff
    safetylevel enum ASIL-C
    rationale "Clinical decision accuracy requires ±3 mmHg measurement precision"
    verificationcriteria "Accuracy testing against calibrated reference per ANSI/AAMI SP10:2002"
    status enum approved

  def requirement REQ_MEAS_002
    name "Measurement Completion Time"
    description "WHEN initiated by user THE system SHALL complete automatic blood pressure measurement WITHIN 120 seconds"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    reqtype enum system
    refinedfrom ref requirement ClinicalWorkflowRequirements, UserExperienceStandards
    allocatedto ref block MeasurementSubsystem
    safetylevel enum ASIL-B
    rationale "Timely measurements required for clinical efficiency and patient comfort"
    verificationcriteria "Timing verification during normal operation per test protocol TS_MEAS_001"
    status enum approved

  //.... multiple requirement definitions allowed

```

##### **Allowed properties for reqset**
###### name, description, config, owner, tags - are the only allowed properties of a reqset.

##### **Allowed properties for requirement**
###### name, description, owner, tags, safetylevel, rationale, veriticationcriteria, status, reqtype, config - are the allowed properties of a requirement.
###### enables, allocatedto, derivedfrom, refinedfrom are optionally allowed relation properties of a requirement.

##### **Validation and error handling**
###### - requirement file (.req) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - multiple .req files allowed in a project.
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

#### **.tst file structure**
##### Test cases are defined by .tst files. .tst files can be multiple, and it can be multiple under a folder and in various folders. 

##### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| testset | <header-def-keyword> |
| name | <property> |
| description | <property> |
| owner | <property> |
| tags | <property> |
| safetylevel | <enum> |
| def | definition|
| testcase | <def-keyword> |
| refinedfrom | <relation-keyword> |
| derivedfrom | <relation-keyword> |
| requirement | <relation-def-keyword> |
| satisfies | <relation-keyword> |
| requirement | <relation-def-keyword> |
| ref | reference |
| config | <config-keyword> |
| expected | <property> |
| passcriteria | <property> |
| testresult | <enum> |
| list | <list-keyword> |
| step | <property> |
| method | <enum> |
| setup | <property> |


##### **Sample code**
```
use reqset BloodPressureSystemRequirements
use configset BloodPressureVariantsConfigs

hdef testset BloodPressureSystemTests
  name "Blood Pressure Monitoring System Test Suite"
  description "Comprehensive test cases for WiFi-enabled clinical blood pressure monitoring system validation"
  owner "Test Engineering Team"
  ref config c_AdvancedAlgorithms_PredictiveAnalytics
  
  def testcase TC_MEAS_001
    name "Blood Pressure Measurement Accuracy Test"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    description "Verify blood pressure measurement accuracy meets ±3 mmHg specification"
    satisfies ref requirement REQ_MEAS_001
    method HIL
    setup "Device connected to calibrated pressure reference, standard test cuff"
    list steps
      step "Connect device to pressure reference standard"
      step "Apply known pressure sequences from 60-280 mmHg systolic"
      step "Record device measurements vs reference values"
      step "Calculate measurement error for each data point"
    expected "All measurements within ±3 mmHg of reference values"
    passcriteria "95% of measurements within ±3 mmHg, 100% within ±5 mmHg"
    safetylevel ASIL-C
    testresult intest
    
  def testcase TC_MEAS_002
    name "Measurement Timing Performance Test"
    description "Verify measurement completion within 120 second time limit"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    satisfies ref requirement REQ_MEAS_002
    method SIL
    setup "Device in normal operating mode, standard adult cuff"
    list steps
      step "Initiate measurement using start button"
      step "Record timestamp at measurement start"
      step "Monitor measurement progress"
      step "Record timestamp at measurement completion"
    expected "Measurement completes within 120 seconds"
    passcriteria "All measurements complete within 120 seconds under normal conditions"
    safetylevel ASIL-B
    testresult pass

  //.... multiple testcase definitions allowed

```

##### **Allowed properties for testset**
###### name, description, config, owner, tags - are the only allowed properties of a reqset.

##### **Allowed properties for test case**
###### name, description, owner, tags, safetylevel, setup, passcriteria, testresult, expected, config, method, list, steps, step - are the allowed properties of a test case.
###### satisfies, derivedfrom, refinedfrom are optionally allowed relation properties of a test case.

##### **Validation and error handling**
###### - test case file (.tst) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - multiple .tst files allowed in a project.
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

#### **.blk file structure**
##### Blocks are defined by .blk files. .blk files can be multiple, and it can be multiple under a folder and in various folders. 

##### **Allowed Keywords**
| Keyword | Type |
|---------|------|
| hdef | header definition|
| block | <header-def-keyword> |
| name | <property> |
| description | <property> |
| designrationale | <property> |
| owner | <property> |
| tags | <property> |
| level | <enum> |
| safetylevel | <enum> |
| def | definition|
| port | <def-keyword> |
| porttype | <enum> |
| in | <direction-keyword> |
| out | <direction-keyword> |
| composedof | <relation-keyword> |
| block | <relation-def-keyword> |
| enables | <relation-keyword> |
| feature | <relation-def-keyword> |
| ref | reference |
| config | <config-keyword> |
| inherits | <relation-keyword> |


##### **Sample code**
```
use block MeasurementSubsystem
use featureset BloodPressureFeatures
use configset BloodPressureVariantsConfigs

hdef block BloodPressureMonitoringSystem
  name "Blood Pressure Monitoring System"
  description "Complete WiFi-enabled clinical blood pressure monitoring system"
  level enum system
  ref config c_AdvancedAlgorithms_PredictiveAnalytics
  owner "Systems Engineering Team"
  tags "blood-pressure", "system", "medical-device", "WiFi"
  safetylevel enum ASIL-C
  composedof ref block MeasurementSubsystem
  enables ref feature UserInterface
  designrationale "blah blah"
  inherits ref block AdvancedFeatures

  ref port in CuffPressureOutput
 
  def port out BloodPressureResults
    name "Blood Pressure Measurement Results"
    description "Systolic and diastolic pressure readings with metadata"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    porttype enum data
    owner "Measurement Team"
    safetylevel ASIL-C
    tags "measurement", "clinical-data", "patient-data"
  
  def port out WiFiDataStream
    name "WiFi Data Transmission"
    description "Encrypted patient data transmission over WiFi"
    ref config c_AdvancedAlgorithms_PredictiveAnalytics
    porttype enum communication
    owner "Connectivity Team"
    safetylevel ASIL-B
    tags "WiFi", "encrypted", "patient-data"


  //.... multiple port out definitions allowed

```

##### **Allowed properties for block**
###### name, description, config, owner, tags, designrationale - are the only allowed properties of a fucntionset.
###### enables, composedof are optionally allowed relation properties of a block.

##### **Allowed properties for port**
###### name, description, config, owner, tags, safetylevel, porttype - are the allowed properties of a port out.

##### **Validation and error handling**
###### - Block file (.blk) shall not have any other keyword than the one specified above. Every line starts with one of those keywords [may have additional keywords in the same line depends on the statement], if there are different keywords used, throw an error. 
###### - multiple .blk files allowed in a project.
###### - if the indentation is not multiple of 2 spaces or a tab, then throw an error.

##### **Enhanced Port Definition Rules**:
###### - Port definitions simplified: `def port <identifier>` (no direction required)
###### - Port references use relation: `needs ref port <identifier>`
###### - Ports can use configuration: `when ref config <config-identifier>`
###### - Port properties: name, description, porttype, owner, safetylevel, tags
###### - No optional flags allowed for port definitions

### Inherits Relation

The `inherits` relation allows hierarchical inheritance across different file types:

- **In .fml files**: `inherits ref featureset <identifier>` - Inherit features from parent feature set
- **In .vml files**: `inherits ref variantset <identifier>` - Inherit variant selections from parent variant set  
- **In .vcf files**: `inherits ref configset <identifier>` - Inherit configuration values from parent config set

**Example:**
```sylang
// ProductLine.fml
hdef featureset AutomotiveFeatures
    name "Automotive Feature Set"
    
def feature SafetySystems
    name "Safety Systems"
    mandatory

// System.fml  
hdef featureset SafetySystemFeatures
    name "Safety System Features"
    inherits ref featureset AutomotiveFeatures
    
def feature ABS
    name "Anti-lock Braking System"
    mandatory
```

### Level Enum

The `level` enum replaces `blocktype` and provides consistent hierarchical levels across all file types:

- `productline` - Top-level product line features
- `system` - System-level features and blocks
- `subsystem` - Subsystem-level features and blocks  
- `component` - Component-level features and blocks
- `module` - Module-level features and blocks
- `interface` - Interface-level features and blocks

**Example:**
```sylang
// .blk file
hdef block BrakeSystem
    name "Brake System Block"
    level system
    description "Vehicle braking system"

// .fml file
hdef featureset SystemFeatures  
    name "System Level Features"
    level system
    description "System-level feature set"
```

### **Sylang Symbol Manager and Validation**
#### Sylang Symbol Manager
##### Sylang symbols follow Parent-child relation. hdef identifiers are parent symbols, and def identifiers are child symbols. They are also clearly indented to show the parent-child relationship. Only .fml files show the nested relations between defs. In this case, carefully align the parent-child-siblings relation between the symbols.
#### Enhanced Symbol Visibility and Cross-File Validation
##### Symbols are visible in any file using `use` statements only. A file will not be able to resolve any identifiers to be used in `ref` without `use` statement. Once the `use` with a `hdef` keyword is specified, then the parent and all of its children are visible to that file.

#### Strict Import and Reference Rules:
1. **Import Rules**: `use` shall only reference header symbols (defined with `hdef`), never child symbols
2. **Reference Rules**: To reference any identifier (local or external), `ref` must be explicitly used
3. **Unused Import Detection**: If a `use` statement imports symbols but none are referenced, show warning: `"Unused import 'X'. Consider removing this 'use' statement."`
4. **Missing Import Detection**: Referencing external symbols without `use` shows error: `"Reference to 'X' requires a 'use' statement."`

#### Advanced Nested Hierarchy Support:
##### The system now supports complex parent-child-grandparent relationships:
```
BloodPressureFeatures (featureset)     ← Level 0 (import target)
  └─ UserInterface (feature group)     ← Level 1 (intermediate parent)
      └─ DisplayScreen (feature)       ← Level 2 (actual child)
```

##### Hierarchy Resolution Algorithm:
- **Direct Match**: `DisplayScreen` references directly resolve
- **Child Match**: `enables ref feature DisplayScreen` marks `BloodPressureFeatures` as used
- **Grandparent Walk**: System walks up hierarchy: `DisplayScreen → UserInterface → BloodPressureFeatures`
- **Cross-File Detection**: Children in different files from parents are properly detected

#### Enhanced Validation Error Codes:
- `SYLANG_UNRESOLVED_REF`: Symbol not found in project
- `SYLANG_MISSING_USE_STATEMENT`: External symbol needs import
- `SYLANG_UNUSED_IMPORT`: Imported symbol not referenced
- `SYLANG_DISABLED_SYMBOL`: Symbol disabled by configuration
- `SYLANG_INVALID_RELATIONSHIP_TARGET`: Wrong target type for relation
- `SYLANG_RESOLVES_IN_HIGH_LEVEL_FILE`: resolves used in wrong file type

#### Symbol Resolution Priority:
1. **Local Symbols**: Check current file first (header and definitions)
2. **Imported Symbols**: Check through `use` statements with visibility filtering
3. **Child Symbol Resolution**: Recursively check children of imported parents
4. **Configuration Filtering**: Apply config-based availability rules
5. **Error Generation**: Distinguish between missing, disabled, and import-required symbols
#### Relationship keywords
##### Relation keywords are associated with certain def/hdef keywords only. The following is the list.
###### listedfor ref productline
###### implements ref function
###### enables ref feature
###### allocatedto ref block
###### derivedfrom ref requirement
###### satisfies ref requirement
###### extends ref feature
###### refinedfrom ref requirement
###### composedof ref block
###### needs ref port
###### requires ref feature
###### excludes ref feature
###### generatedfrom ref variantset
###### when ref config

#### Enhanced Relationship Validation Rules
##### Each relationship keyword enforces strict target type validation:
- **resolves**: Only allows `ref config <config-identifier>` - Used for configuration-based symbol availability
- **enables**: Only allows `ref feature <feature-identifier>` 
- **needs**: Only allows `ref port <port-identifier>`
- **composedof**: Only allows `ref block <block-identifier>`
- **requires/excludes**: Only allows `ref feature <feature-identifier>`
- **generatedfrom**: Only allows `ref variantset <variantset-identifier>`

##### File Type Restrictions for Relations:
- **when ref config**: NOT allowed in high-level files (.ple, .fml, .vml, .vcf) - Only in implementation files (.blk, .fun, .req, .tst)
- Other relations: Allowed based on context and file type requirements

#### Configuration-Based Symbol Availability and Visual Feedback
##### The Sylang language implements comprehensive configuration-based feature management through config values and visual feedback.

#### Config Usage Patterns:
1. **New Pattern**: `when ref config <config-identifier>` (Recommended)
2. **Legacy Pattern**: `ref config <config-identifier>` (Backward compatibility)

#### Visual Graying Behavior:
- **Individual Symbol Disabled** (`def` with `when ref config` where config value = 0):
  - Only that specific definition is grayed out
  - Symbol becomes completely unavailable for reference
- **Whole File Disabled** (`hdef` with `when ref config` where config value = 0):
  - Entire file content is grayed out
  - ALL symbols in the file become unavailable for reference

#### Functional Symbol Availability Rules:
##### When config value = 0 (disabled):
1. **Symbol Resolution**: Disabled symbols are excluded from `getAllSymbols()` 
2. **Cross-File References**: Referencing disabled symbols produces `SYLANG_DISABLED_SYMBOL` error
3. **Import Validation**: Disabled symbols cannot be imported or used via `use` statements
4. **Nested Visibility**: If parent symbol is disabled, all children are automatically disabled
5. **Hierarchical Inheritance**: Config definitions themselves remain visible (they define the values)

#### Symbol Visibility Algorithm:
```typescript
isSymbolVisible(symbol) {
  // Config definitions always visible
  if (symbol.kind === 'config') return true;
  
  // Check file-level disabling (hdef with disabled config)
  if (headerSymbol.hasDisabledConfig()) return false;
  
  // Check individual symbol disabling
  if (symbol.hasDisabledConfig()) return false;
  
  // Check parent visibility recursively
  if (parent && !isSymbolVisible(parent)) return false;
  
  return true;
}
```

#### Enhanced Error Messages:
- **Missing Symbol**: `"Unresolved reference to 'X'. Symbol not found in project."`
- **Disabled Symbol**: `"Reference to 'X' is not available because the symbol is disabled by configuration."`
- **Missing Import**: `"Reference to 'X' requires a 'use' statement. Add 'use <type> X' at the top of the file."`

#### Config Resolution:
- Config values are resolved from `.vcf` files using hierarchical naming
- Example: `c_AdvancedAlgorithms_ArrhythmiaDetection` corresponds to feature hierarchy
- Values: `1` = enabled, `0` = disabled

### Advanced Technical Implementation Details

#### Version Management and Logging System
##### The extension implements centralized version management for consistent tracking:
- **Version Module**: `src/core/version.ts` exports `SYLANG_VERSION` constant
- **Version-Aware Logging**: All log messages include version for debugging
- **Package Synchronization**: `package.json` version must match `SYLANG_VERSION`
- **Versioned Messages**: Error messages include version for issue tracking
- **Debug vs Info Logging**: Use `logger.info()` for user-visible debug, `logger.debug()` for internal debug

#### Modular Architecture Design
##### Core Modules:
1. **SymbolManager** (`src/core/symbolManager.ts`):
   - In-memory symbol table with real-time updates
   - Cross-file symbol resolution with visibility filtering
   - Parent-child hierarchy tracking with nested support
   - Configuration-based symbol availability
   
2. **ValidationEngine** (`src/core/validationEngine.ts`):
   - Real-time validation with comprehensive error codes
   - Cross-file reference validation
   - Import usage detection with nested hierarchy support
   - Property validation and relationship rule enforcement

3. **DecorationProvider** (`src/core/decorationProvider.ts`):
   - Visual graying out for disabled symbols
   - File-level and symbol-level decoration logic
   - Configuration value resolution and visibility checking

4. **ImportValidator** (`src/core/importValidator.ts`):
   - Unused import detection with warning generation
   - Child symbol usage detection for import marking
   - Nested hierarchy support for import resolution

5. **RelationshipValidator** (`src/core/relationshipValidator.ts`):
   - Strict relationship target type validation
   - File type restrictions for relation usage
   - Extensible relationship rule definitions

#### Keywords System Architecture
##### The keyword system is designed for easy extension:
```typescript
// src/core/keywords.ts - Extensible keyword definitions
export const SYLANG_FILE_TYPES: FileTypeKeywords[] = [
  // Add new file types here
];

export const SYLANG_ENUMS: EnumDefinition[] = [
  // Add new enum values here
];
```

##### Keyword Types:
- `HEADER_DEFINITION`: hdef keywords (productline, featureset, etc.)
- `DEFINITION`: def keywords (feature, port, function, etc.)
- `PROPERTY`: Properties (name, description, owner, etc.)
- `RELATION`: Relations (enables, requires, resolves, etc.)
- `REFERENCE`: References (ref, use)
- `ENUM`: Predefined enums (ASIL-A, HIL, etc.)
- `CONFIG`: Configuration references

#### Symbol Parsing and Property Handling
##### Enhanced property parsing supports:
- **Relation Keywords**: `resolves`, `enables`, `needs`, `composedof`, etc.
- **Config Resolution**: Both `when ref config` and `ref config` patterns
- **Nested Properties**: Multi-level symbol properties with inheritance
- **Validation Integration**: Property-level validation with relationship rules

#### File Generation Commands
##### Implemented commands with proper file management:
- **Create .vml from .fml**: Right-click .fml file → Generate variant template
- **Create .vcf from .vml**: Right-click .vml file → Generate configuration
- **Create .sylangrules**: Command palette → Create Sylang project rules
- **Create Project Structure**: Command palette → Create recommended folders

#### Real-Time Validation Architecture
##### Multi-layered validation system:
1. **Syntax Validation**: Grammar and indentation checking
2. **Import Validation**: Use statement and unused import detection  
3. **Reference Validation**: Symbol existence and availability checking
4. **Relationship Validation**: Target type and file restriction validation
5. **Configuration Validation**: Config value resolution and availability rules

#### Extension Points for Future Development
##### Designed for extensibility:
- **New File Types**: Add to `SYLANG_FILE_TYPES` array with allowed keywords
- **New Keywords**: Add to appropriate keyword arrays with type classification
- **New Relations**: Add to `RELATIONSHIP_RULES` with target type restrictions
- **New Enums**: Add to `SYLANG_ENUMS` with value definitions
- **New Validation Rules**: Extend validation methods with modular approach

### Current Implementation Scope (v2.0.2)

> **⚠️ IMPORTANT FOR AI DEVELOPERS**
> 
> **FULLY IMPLEMENTED (7 Extensions)**: The current VSCode extension completely implements and validates these file types:
> - **Product Line**: `.ple`, `.fml`, `.vml`, `.vcf` 
> - **Systems Engineering**: `.blk`, `.fun`, `.req`, `.tst`
> 
> **PLANNED FOR FUTURE**: These extensions are specified but NOT YET IMPLEMENTED:
> - **Systems Analysis**: `.fma`, `.fmc`, `.fta`
> - **Safety Analysis**: `.itm`, `.haz`, `.rsk`, `.sgl` 
> - **General**: `.enm`
> 
> When working on this extension, focus only on the 7 implemented file types. The architecture is designed to easily extend to the remaining extensions once the core functionality is stable and tested.

### File Structure Rules

#### Folder-Level Limitations
- **One `.fml` file per folder** - Only one feature model allowed per folder
- **One `.vcf` file per folder** - Only one configuration file allowed per folder  
- **Multiple `.vml` files per folder** - Multiple variant definitions allowed per folder

#### Project Structure Example
```
📁 project/
├── 📁 productline/
│   ├── 📄 ProductLine.fml          (ONE per folder)
│   ├── 📄 ProductLine.vcf          (ONE per folder)
│   ├── 📄 ProductLine.vml          (variant 1)
│   ├── 📄 ProductLinePremium.vml   (variant 2)
│   └── 📄 ProductLineBasic.vml     (variant 3)
├── 📁 systems/
│   ├── 📄 SafetySystem.fml         (ONE per folder)
│   ├── 📄 SafetySystem.vcf         (ONE per folder)
│   ├── 📄 SafetySystem.vml         (variant 1)
│   └── 📄 SafetySystemAdvanced.vml (variant 2)
└── 📁 subsystems/
    ├── 📄 BrakeSystem.fml          (ONE per folder)
    ├── 📄 BrakeSystem.vcf          (ONE per folder)
    ├── 📄 BrakeSystem.vml          (variant 1)
    └── 📄 BrakeSystemABS.vml       (variant 2)
```

#### Validation Rules
- **Multiple .fml files in same folder**: Error - "Multiple .fml files found in folder. Only one .fml file allowed per folder."
- **Multiple .vcf files in same folder**: Error - "Multiple .vcf files found in folder. Only one .vcf file allowed per folder."
- **Multiple .vml files in same folder**: Allowed - Different variant definitions for the same feature set

### Relation Cardinality

Relations support different cardinalities for identifiers:

#### Single Identifier Relations (1:1)
- `extends ref feature <identifier>` - One feature per extends relation
- `inherits ref featureset <identifier>` - One featureset per inherits relation
- `inherits ref variantset <identifier>` - One variantset per inherits relation
- `inherits ref configset <identifier>` - One configset per inherits relation
- `listedfor ref productline <identifier>` - One productline per listedfor relation
- `generatedfrom ref variantset <identifier>` - One variantset per generatedfrom relation
- `allocatedto ref block <identifier>` - One block per allocatedto relation

#### Multiple Identifier Relations (1:many)
- `enables ref feature <identifier1>, <identifier2>, <identifier3>` - Multiple features per enables relation
- `requires ref feature <identifier1>, <identifier2>` - Multiple features per requires relation
- `excludes ref feature <identifier1>, <identifier2>` - Multiple features per excludes relation
- `composedof ref block <identifier1>, <identifier2>, <identifier3>` - Multiple blocks per composedof relation
- `needs ref port <identifier1>, <identifier2>` - Multiple ports per needs relation

#### Examples:
```sylang
// Single identifier relations
extends ref feature SafetySystems mandatory
inherits ref featureset AutomotiveFeatures

// Multiple identifier relations  
enables ref feature UserInterface, RealTimeEditing, Collaboration
composedof ref block BrakeController, ABSModule, ESPModule
requires ref feature Database, Authentication, Authorization
```

#### Diagrams
Extending this extension to work on webview. We need some system architecture diagrams. Currently we support 7 extensions, and we need diagrams for Featuremodel, variant model and blocks as the first step. Also we need an extension graph traversal diagrams, that basically shows all nodes and relations. hdef and def are the nodes, and relation keywords are edges between those nodes. 

##### How does the diagrams are opened?
In the left project tree structure of vscode - clicking .fml, .vml, .blk shall open a diagram - not the editor. Right click and edit shall open the file in the editor panel. The diagram has to be opned in the full window of editor panel, not the default split window. 

### Sylang Diagram Architecture (v3.0.0)

#### Overview
The Sylang diagram system provides read-only, high-performance visual representations of Sylang files using custom-built Preact/Vite webviews. The architecture is completely decoupled from existing validation and symbol management systems, treating Sylang files as pure input data sources.

#### Core Design Principles
1. **Complete Decoupling**: Diagrams are independent of existing validation/symbol systems
2. **Read-Only Interface**: All diagrams are view-only, no editing capabilities
3. **High Performance**: Support for thousands of nodes with real-time updates
4. **Extensible Architecture**: Easy addition of new diagram types without affecting existing ones
5. **Custom Rendering**: Domain-specific diagrams optimized for Sylang semantics
6. **Real-Time Synchronization**: Live updates when files change or diagrams are focused

#### Diagram Types & Layout Algorithms

##### 1. Feature Model Diagrams (.fml)
**Purpose**: Hierarchical tree visualization of feature models with constraint relationships

**Layout Algorithm**: **Hierarchical Tree Layout**
- **Root Placement**: Root feature at top center
- **Child Distribution**: Children arranged horizontally under parent
- **Level Spacing**: Consistent vertical spacing between levels
- **Sibling Spacing**: Horizontal spacing based on sibling count
- **Orientation Options**: Both Left-to-Right and Top-to-Bottom hierarchy layouts
- **Constraint Visualization**: 
  - Mandatory: Solid black circle at end of vertical line
  - Optional: Empty (outline) circle at end of vertical line
  - OR groups: Solid black triangle on horizontal line connecting siblings
  - Alternative groups: Empty (outline) triangle on horizontal line connecting siblings

**Visual Elements**:
- **Feature Nodes**: Text labels with subtle rectangular boundaries
- **Hierarchy Lines**: Vertical lines connecting parent to children
- **Constraint Indicators**: Circles and triangles on connection lines
- **Cross-Feature Relationships**: 
  - Requires: Green dotted arrow connectors between features
  - Excludes: Red dotted arrow connectors between features
- **Diagram Heading**: Displayed from the `name` property of the featureset

**Layout Options**:
- **Top-to-Bottom**: Traditional hierarchical layout (default)
- **Left-to-Right**: Alternative orientation for wide diagrams

##### 2. Variant Model Diagrams (.vml)
**Purpose**: Visualization of variant selections and feature configurations

**Layout Algorithm**: **Modified Hierarchical with Selection Highlighting**
- **Base Layout**: Same as Feature Model but with selection states
- **Selection Visualization**: 
  - Selected features: Green background
  - Unselected features: Gray background
  - Mandatory selected: Green with solid border
  - Optional selected: Green with dashed border
- **Constraint Validation**: Visual indicators for constraint violations

**Visual Elements**:
- **Selection States**: Color-coded backgrounds and borders
- **Constraint Warnings**: Red highlights for violated constraints
- **Selection Counters**: Numbers showing selected vs total features

##### 3. Block Diagrams (.blk)
**Purpose**: System architecture visualization with blocks, ports, and connections

**Layout Algorithm**: **Force-Directed Graph Layout**
- **Block Positioning**: Force-directed placement to minimize overlaps
- **Port Placement**: Ports positioned around block perimeter
- **Connection Routing**: Orthogonal routing to avoid overlaps
- **Hierarchy Visualization**: Nested blocks shown as containers

**Visual Elements**:
- **System Blocks**: Large rectangles representing system components
- **Subsystem Blocks**: Smaller rectangles within system blocks
- **Ports**: Small circles on block edges
- **Connections**: Orthogonal lines between ports
- **Data Flow**: Arrowheads showing data direction

##### 4. Extension Graph Traversal (.all)
**Purpose**: Neo4j-style graph showing all symbols and relationships across the project

**Layout Algorithm**: **Force-Directed Graph with Clustering**
- **Node Positioning**: Force-directed algorithm with repulsion/attraction
- **Cluster Formation**: Related symbols grouped into visual clusters
- **Edge Routing**: Curved edges to avoid overlaps
- **Zoom Levels**: Multiple detail levels for large graphs
- **Performance Target**: Support for up to 100,000 nodes (including all requirements, tests, functions, etc.)

**Visual Elements**:
- **Symbol Nodes**: Different shapes for hdef vs def symbols
- **Relationship Edges**: Labeled arrows showing relation types
- **File Clusters**: Color-coded groups by source file
- **Symbol Types**: Different colors for different symbol kinds

#### Layout Algorithm Details

##### Hierarchical Tree Layout
```typescript
interface HierarchicalLayout {
  // Root placement at top center
  rootPosition: { x: number, y: number };
  
  // Child distribution under parent
  childSpacing: number;
  levelSpacing: number;
  
  // Sibling arrangement
  siblingDistribution: 'horizontal' | 'vertical';
  
  // Orientation options
  orientation: 'top-to-bottom' | 'left-to-right';
  
  // Constraint visualization
  constraintIndicators: boolean;
}

// Algorithm steps:
1. Calculate tree depth and width
2. Position root at top center (or left center for left-to-right)
3. For each level, distribute children horizontally (or vertically for left-to-right)
4. Connect parents to children with vertical lines (or horizontal for left-to-right)
5. Add constraint indicators (circles and triangles on connection lines)
6. Add cross-feature relationship arrows (requires/excludes)
```

##### Force-Directed Graph Layout
```typescript
interface ForceDirectedLayout {
  // Force parameters
  repulsionForce: number;
  attractionForce: number;
  dampingFactor: number;
  
  // Convergence criteria
  maxIterations: number;
  convergenceThreshold: number;
  
  // Overlap prevention
  minDistance: number;
  overlapPenalty: number;
}

// Algorithm steps:
1. Initialize random positions for all nodes
2. Calculate repulsion forces between all node pairs
3. Calculate attraction forces for connected nodes
4. Apply forces to update node positions
5. Check for overlaps and apply penalties
6. Repeat until convergence or max iterations
```

##### Orthogonal Connection Routing
```typescript
interface OrthogonalRouting {
  // Routing parameters
  gridSize: number;
  bendPenalty: number;
  crossingPenalty: number;
  
  // Path finding
  algorithm: 'A*' | 'Dijkstra';
  heuristic: 'manhattan' | 'euclidean';
}

// Algorithm steps:
1. Create routing grid from block positions
2. Find shortest orthogonal path between ports
3. Minimize bends and crossings
4. Route connections with proper spacing
```

#### Architecture Components

##### 1. Core Diagram Infrastructure
```
📁 src/diagrams/
├── 📁 core/
│   ├── diagramManager.ts          # Main orchestration
│   ├── diagramProvider.ts         # VSCode webview provider
│   ├── diagramRenderer.ts         # Preact rendering engine
│   ├── diagramDataTransformer.ts  # Symbol → diagram data
│   └── diagramLayoutEngine.ts     # Layout algorithm engine
├── 📁 types/
│   ├── diagramTypes.ts            # TypeScript interfaces
│   ├── diagramEnums.ts            # Diagram-specific enums
│   └── layoutTypes.ts             # Layout algorithm types
├── 📁 renderers/
│   ├── baseRenderer.ts            # Base renderer class
│   ├── featureModelRenderer.ts    # .fml diagram renderer
│   ├── variantModelRenderer.ts    # .vml diagram renderer
│   ├── blockDiagramRenderer.ts    # .blk diagram renderer
│   └── graphTraversalRenderer.ts  # Extension graph renderer
└── 📁 webview/
    ├── 📁 dist/                   # Vite build output
    ├── 📁 src/
    │   ├── main.tsx               # Preact entry point
    │   ├── components/
    │   │   ├── DiagramContainer.tsx
    │   │   ├── FeatureModelDiagram.tsx
    │   │   ├── VariantModelDiagram.tsx
    │   │   ├── BlockDiagram.tsx
    │   │   ├── GraphTraversal.tsx
    │   │   └── common/
    │   │       ├── DiagramNode.tsx
    │   │       ├── DiagramEdge.tsx
    │   │       ├── DiagramToolbar.tsx
    │   │       └── DiagramHeading.tsx
    │   ├── hooks/
    │   │   ├── useDiagramData.ts
    │   │   ├── usePerformance.ts
    │   │   └── useLayout.ts
    │   ├── utils/
    │   │   ├── diagramUtils.ts
    │   │   ├── performanceUtils.ts
    │   │   └── layoutUtils.ts
    │   └── algorithms/
    │       ├── hierarchicalLayout.ts
    │       ├── forceDirectedLayout.ts
    │       └── orthogonalRouting.ts
    ├── package.json               # Webview dependencies
    ├── vite.config.ts             # Vite configuration
    └── tsconfig.json              # Webview TypeScript config
```

##### 2. Data Flow Architecture
```
Sylang Files → Diagram Data Transformer → Layout Engine → Renderer → Preact Components → Webview
     ↓              ↓                      ↓           ↓              ↓
File Changes → Real-time Updates → Layout Recalculation → Re-render → Visual Update
```

##### 3. Performance Architecture
```
📁 Performance Layers:
├── Data Layer
│   ├── Incremental Parsing        # Parse only changed sections
│   ├── Compressed Data Transfer   # Minimize webview message size
│   └── Caching Strategy          # Cache parsed data and layouts
├── Rendering Layer
│   ├── Virtualization            # Only render visible elements
│   ├── Canvas Rendering          # Use Canvas for large diagrams
│   ├── WebGL Rendering           # Use WebGL for complex diagrams
│   └── CSS Transforms            # Hardware-accelerated animations
├── Update Layer
│   ├── Debounced Updates         # Batch multiple file changes
│   ├── Delta Updates             # Update only changed elements
│   ├── Background Processing     # Process in web workers
│   └── Progressive Loading       # Load diagram in stages
└── Memory Layer
    ├── Object Pooling            # Reuse diagram objects
    ├── Weak References           # Use weak maps for caching
    ├── Garbage Collection        # Explicit cleanup
    └── Memory Monitoring         # Monitor memory usage
```

#### Real-Time Update Strategy

##### Update Triggers
1. **File Click**: When user clicks .fml/.vml/.blk file in project tree
2. **Diagram Focus**: When diagram webview gains focus in editor panel
3. **File Changes**: When underlying Sylang files are modified
4. **Manual Refresh**: User-initiated refresh command

##### Update Flow
```typescript
// Update trigger detection
fileWatcher.onDidChange((uri) => {
  if (isDiagramFile(uri) && isDiagramOpen(uri)) {
    diagramManager.queueUpdate(uri);
  }
});

// Debounced update processing
class DiagramUpdateQueue {
  private updateQueue = new Map<string, NodeJS.Timeout>();
  
  queueUpdate(fileUri: vscode.Uri) {
    // Cancel existing timeout for this file
    const existing = this.updateQueue.get(fileUri.toString());
    if (existing) clearTimeout(existing);
    
    // Schedule new update
    const timeout = setTimeout(() => {
      this.processUpdate(fileUri);
      this.updateQueue.delete(fileUri.toString());
    }, 300); // 300ms debounce
    
    this.updateQueue.set(fileUri.toString(), timeout);
  }
}
```

#### Extensibility Architecture

##### 1. Renderer Extension Pattern
```typescript
// Base renderer interface
interface IDiagramRenderer {
  readonly type: DiagramType;
  render(data: DiagramData): Promise<DiagramResult>;
  update(data: DiagramData): Promise<DiagramResult>;
  dispose(): void;
}

// Renderer registry
class DiagramRendererRegistry {
  private renderers = new Map<DiagramType, IDiagramRenderer>();
  
  register(type: DiagramType, renderer: IDiagramRenderer) {
    this.renderers.set(type, renderer);
  }
  
  getRenderer(type: DiagramType): IDiagramRenderer | undefined {
    return this.renderers.get(type);
  }
}

// Adding new diagram type
class StateMachineRenderer implements IDiagramRenderer {
  readonly type = DiagramType.StateMachine;
  
  async render(data: StateMachineData): Promise<DiagramResult> {
    // Custom state machine rendering logic
  }
}

// Registration
rendererRegistry.register(DiagramType.StateMachine, new StateMachineRenderer());
```

##### 2. Layout Algorithm Extension
```typescript
// Base layout interface
interface ILayoutAlgorithm {
  readonly name: string;
  layout(nodes: DiagramNode[], edges: DiagramEdge[]): Promise<LayoutResult>;
  supportsAnimation(): boolean;
}

// Layout registry
class LayoutAlgorithmRegistry {
  private algorithms = new Map<string, ILayoutAlgorithm>();
  
  register(name: string, algorithm: ILayoutAlgorithm) {
    this.algorithms.set(name, algorithm);
  }
}

// Adding new layout algorithm
class CircularLayout implements ILayoutAlgorithm {
  readonly name = 'circular';
  
  async layout(nodes: DiagramNode[], edges: DiagramEdge[]): Promise<LayoutResult> {
    // Circular layout implementation
  }
}
```

#### VSCode Integration

##### 1. Custom Editor Provider
```typescript
class SylangDiagramProvider implements vscode.CustomTextEditorProvider {
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'sylang.diagram',
      new SylangDiagramProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }
  
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Set up webview with diagram content
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'src/diagrams/webview/dist'))]
    };
    
    // Load appropriate diagram based on file type
    const diagramType = this.getDiagramType(document);
    const diagramData = await this.loadDiagramData(document);
    
    webviewPanel.webview.html = this.getWebviewContent(diagramType, diagramData);
  }
}
```

#### Build & Development Workflow

##### 1. Development Setup
```json
// package.json additions
{
  "scripts": {
    "build:webview": "cd src/diagrams/webview && vite build",
    "dev:webview": "cd src/diagrams/webview && vite dev",
    "watch:webview": "cd src/diagrams/webview && vite build --watch",
    "build:extension": "npm run build:webview && tsc -p ./",
    "watch:extension": "npm run watch:webview & tsc -watch -p ./"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "preact": "^10.19.0",
    "@preact/preset-vite": "^2.8.0",
    "@types/node": "^16.x"
  }
}
```

##### 2. Extension Integration
```typescript
// extension.ts additions
import { SylangDiagramManager } from './diagrams/core/diagramManager';

let diagramManager: SylangDiagramManager;

// In activate function
diagramManager = new SylangDiagramManager(logger, symbolManager);
context.subscriptions.push(diagramManager);

// Register custom editor provider
const diagramProvider = SylangDiagramProvider.register(context);
context.subscriptions.push(diagramProvider);
```

#### Implementation Phases

##### Phase 1: Core Infrastructure (Week 1)
1. Set up Vite/Preact webview build system
2. Create diagram manager and provider classes
3. Implement basic webview communication
4. Add custom editor registration for .fml/.vml/.blk files

##### Phase 2: Feature Model Diagrams (Week 2)
1. Implement hierarchical tree layout algorithm with orientation options
2. Create feature model diagram renderer (.fml) with constraint visualization
3. Build Preact components for tree visualization with proper constraint indicators
4. Add symbol data transformation for feature models
5. Implement cross-feature relationship arrows (requires/excludes)

##### Phase 3: Advanced Diagrams (Week 3)
1. Implement force-directed layout algorithm
2. Add variant model diagram renderer (.vml) with selection states
3. Create block diagram renderer (.blk) with orthogonal routing
4. Implement real-time update system

##### Phase 4: Graph Traversal (Week 4)
1. Implement extension graph traversal renderer with clustering
2. Add zoom and pan functionality for large graphs
3. Create Neo4j-style graph visualization
4. Optimize for 100,000+ nodes performance

##### Phase 5: Performance & Polish (Week 5)
1. Implement virtualization for large diagrams
2. Add export functionality (PNG, SVG, PDF)
3. Performance testing and optimization
4. Error handling and edge cases

#### Performance Targets

##### Scalability Goals
- **Feature Models**: Support up to 10,000 features
- **Variant Models**: Support up to 5,000 variant selections
- **Block Diagrams**: Support up to 1,000 blocks with ports
- **Graph Traversal**: Support up to 100,000 nodes and edges (including all requirements, tests, functions)

##### Performance Metrics
- **Initial Load**: < 2 seconds for diagrams with 1,000+ elements
- **Update Time**: < 500ms for real-time updates
- **Memory Usage**: < 100MB for large diagrams
- **Smooth Interaction**: 60fps zoom/pan operations

#### Future Extensibility

##### Planned Diagram Types
1. **State Machine Diagrams** (.stm) - State transitions and events
2. **Sequence Diagrams** (.seq) - Message flows and interactions
3. **Activity Diagrams** (.act) - Process flows and decisions
4. **Use Case Diagrams** (.ucs) - Actor interactions and use cases
5. **Component Diagrams** (.cmp) - Software component architecture

##### Layout Algorithm Extensions
1. **Circular Layout** - For cyclic relationships
2. **Radial Layout** - For hub-and-spoke patterns
3. **Sankey Layout** - For flow and data visualization
4. **Timeline Layout** - For temporal relationships

This architecture provides a solid foundation for high-performance, scalable diagram functionality while maintaining complete decoupling from existing systems and ensuring easy extensibility for future diagram types. 