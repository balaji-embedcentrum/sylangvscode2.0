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
###### - **CRITICAL**: Multiple `extends` statements are NOT duplicate properties - each `extends ref feature` is a separate feature reference and must be allowed.

##### **Special .vml rules**
###### - Features must be exact copies of .fml file but use `extends ref` syntax instead of `def` statements
###### - Hierarchical and indented structure must exactly match the corresponding .fml file
###### - The `selected` flag indicates whether a feature is selected for this variant
###### - VML must reference an FML file via `use featureset <identifier>` statement
###### - All features in VML must exist in the referenced FML file
###### - Flag types (mandatory, optional, or, alternative) must match exactly with FML file

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

**Mixed Child Types:**
When a parent has children with different flag types:
- **If parent selected + has mandatory children** → all mandatory children must be selected
- **If parent selected + has mixed mandatory/optional** → all mandatory selected, optional are optional
- **If parent selected + has only optional children** → at least one optional must be selected
- **If parent selected + has only "or" children** → at least one "or" must be selected
- **If parent selected + has only "alternative" children** → at most one "alternative" must be selected

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
| requirementset | <header-def-keyword> |
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

hdef requirementset BloodPressureSystemRequirements
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

##### **Allowed properties for requirementset**
###### name, description, config, owner, tags - are the only allowed properties of a requirementset.

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
| steps | <property> |
| method | <enum> |
| setup | <property> |


##### **Sample code**
```
use requirementset BloodPressureSystemRequirements
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
    steps "Connect device to pressure reference standard \
           Apply known pressure sequences from 60-280 mmHg systolic \
           Record device measurements vs reference values \
           Calculate measurement error for each data point"
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
    steps "Initiate measurement using start button \
           Record timestamp at measurement start \
           Monitor measurement progress \
           Record timestamp at measurement completion"
    expected "Measurement completes within 120 seconds"
    passcriteria "All measurements complete within 120 seconds under normal conditions"
    safetylevel ASIL-B
    testresult pass

  //.... multiple testcase definitions allowed

```

##### **Allowed properties for testset**
###### name, description, config, owner, tags - are the only allowed properties of a testset.

##### **Allowed properties for test case**
###### name, description, owner, tags, safetylevel, setup, passcriteria, testresult, expected, config, method, steps - are the allowed properties of a test case.
###### satisfies, derivedfrom, refinedfrom are optionally allowed relation properties of a test case.

##### **Multi-line String Support**
###### Properties like `name`, `description`, `steps`, `setup`, `expected`, and `passcriteria` support multi-line strings using backslash continuation:
```
steps "Connect device to pressure reference standard \
       Apply known pressure sequences from 60-280 mmHg systolic \
       Record device measurements vs reference values \
       Calculate measurement error for each data point"
```
###### The backslash (\) at the end of a line continues the string on the next line. This works for any property marked as supporting multi-line strings.

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

##### **Enhanced Port Definition Rules** (v2.9.77):
###### - **Port definitions**: `def port <identifier>` (direction determined by usage)
###### - **Port references**: `needs ref port <identifier>` (creates input connections)
###### - **Port direction**: Automatically determined - `needs ref port` creates inputs, `def port` creates outputs
###### - **Port configuration**: `when ref config <config-identifier>` supported
###### - **Port properties**: name, description, porttype, owner, safetylevel, tags
###### - **No optional flags**: No optional flags allowed for port definitions
###### - **IBD Integration**: Ports used in Internal Block Diagrams for visual connections

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

#### Configuration-Based Symbol Availability and Visual Feedback (v2.9.77)
##### The Sylang language implements comprehensive configuration-based feature management through config values, visual feedback, and intelligent validation skipping.

#### Config Usage Patterns:
1. **New Pattern**: `when ref config <config-identifier>` (Recommended)
2. **Legacy Pattern**: `ref config <config-identifier>` (Backward compatibility)

#### Visual Graying Behavior:
- **Individual Symbol Disabled** (`def` with `when ref config` where config value = 0):
  - Only that specific definition is grayed out
  - Symbol becomes completely unavailable for reference
  - All validation errors for that symbol are suppressed
- **Whole File Disabled** (`hdef` with `when ref config` where config value = 0):
  - Entire file content is grayed out
  - ALL symbols in the file become unavailable for reference
  - Entire file validation is skipped to prevent false errors

#### Enhanced Validation Behavior (v2.9.21+):
##### **Config-Aware Validation Engine**:
1. **Consistent Skip Logic**: If both source and target symbols are disabled by the same config, validation is skipped entirely
2. **Hierarchical Inheritance**: When config is applied at `hdef` level, all child `def` symbols inherit the disabled state
3. **Import Error Handling**: Importing disabled symbols shows explicit errors instead of warnings
4. **Grayed-Out Symbol Protection**: Grayed-out symbols skip ALL internal relation validation to prevent false positives

##### **Smart Validation Rules**:
- **When source is disabled**: Skip validation for `validateReference()` and `validateRelationCardinality()`
- **When target is disabled**: Return error only if source is enabled (prevents noise from disabled items)
- **When both disabled**: Return `shouldSkip: true` to suppress all validation
- **File-level disabling**: Skip entire file validation if `hdef` has disabled config

#### Functional Symbol Availability Rules:
##### When config value = 0 (disabled):
1. **Symbol Resolution**: Disabled symbols are excluded from `getAllSymbols()` 
2. **Cross-File References**: Referencing disabled symbols produces `SYLANG_DISABLED_SYMBOL` error
3. **Import Validation**: Disabled symbols cannot be imported (shows `SYLANG_DISABLED_IMPORT` error)
4. **Nested Visibility**: If parent symbol is disabled, all children are automatically disabled
5. **Hierarchical Inheritance**: Config definitions themselves remain visible (they define the values)
6. **Validation Suppression**: Disabled symbols skip validation to prevent false errors

#### Enhanced Symbol Visibility Algorithm (v2.9.77):
```typescript
class SylangConfigManager {
  getNodeState(nodeId: string): NodeConfigState | null {
    // Check direct config
    const directState = this.nodeConfigs.get(nodeId);
    if (directState) return directState;
    
    // Check inherited config from parent
    const parentId = this.getParentNodeId(nodeId);
    if (parentId) {
      const parentState = this.getNodeState(parentId);
      if (parentState && !parentState.isVisible) {
        // Create inherited state
        return {
          nodeId,
          configId: parentState.configId,
          configValue: parentState.configValue,
          isVisible: false,
          renderMode: NodeRenderMode.Grayed,
          configInfo: { inherited: true, source: parentId }
        };
      }
    }
    
    return null; // No config, visible by default
  }
  
  private getParentNodeId(nodeId: string): string | null {
    // Use symbolManager for reliable parent detection
    const symbol = this.symbolManager?.getAllSymbolsRaw()
      .find(s => s.name === nodeId);
    return symbol?.parentSymbol?.name || null;
  }
}
```

#### Enhanced Error Messages:
- **Missing Symbol**: `"Unresolved reference to 'X'. Symbol not found in project."`
- **Disabled Symbol**: `"Reference to 'X' is not available because the symbol is disabled by configuration."`
- **Missing Import**: `"Reference to 'X' requires a 'use' statement. Add 'use <type> X' at the top of the file."`
- **Disabled Import**: `"Cannot import 'X' because it is disabled by configuration."`
- **Inconsistent Config**: `"Inconsistent config state: enabled item references disabled item."`

#### Config Resolution:
- Config values are resolved from `.vcf` files using hierarchical naming
- Example: `c_AdvancedAlgorithms_ArrhythmiaDetection` corresponds to feature hierarchy
- Values: `1` = enabled, `0` = disabled
- **File Exclusions**: `.ple`, `.fml`, `.vml`, `.vcf` files are excluded from config usage validation

### Advanced Technical Implementation Details

#### Version Management and Logging System (v2.9.77)
##### The extension implements centralized version management for consistent tracking:
- **Version Module**: `src/core/version.ts` exports `SYLANG_VERSION` constant (currently v2.9.77)
- **Version-Aware Logging**: All log messages include version for debugging using `getVersionedLogger()`
- **Package Synchronization**: `package.json` version must match `SYLANG_VERSION` (automatic increment)
- **Versioned Messages**: Error messages include version for issue tracking
- **Incremental Versioning**: Always increment third digit unless specifically requested
- **Centralized Updates**: Version bumped in single location, propagated across extension
- **Production Logging**: Always use `logger` instead of `console.log` for production-grade logging
- **WebView Logging**: Dedicated `WebviewLogger` for diagram component debugging

#### Modular Architecture Design
##### Core Modules:
1. **SymbolManager** (`src/core/symbolManager.ts`):
   - In-memory symbol table with real-time updates
   - Cross-file symbol resolution with visibility filtering
   - Parent-child hierarchy tracking with nested support
   - Configuration-based symbol availability with `getAllSymbolsRaw()` and `isSymbolDisabledByConfig()`
   
2. **ValidationEngine** (`src/core/validationEngine.ts`):
   - Real-time validation with comprehensive error codes
   - Config-aware validation with skip logic for disabled symbols
   - Cross-file reference validation with inheritance support
   - Import usage detection with nested hierarchy support
   - Enhanced validation skipping for grayed-out symbols

3. **ConfigManager** (`src/core/configManager.ts`):
   - Configuration propagation system with hierarchical inheritance
   - Node state management with `NodeConfigState` tracking
   - Parent-child config inheritance using `symbol.parentSymbol`
   - Visual graying coordination with decoration provider

4. **DecorationProvider** (`src/core/decorationProvider.ts`):
   - Visual graying out for disabled symbols (file-level and symbol-level)
   - Configuration value resolution and visibility checking
   - Real-time decoration updates based on config changes

5. **ImportValidator** (`src/core/importValidator.ts`):
   - Unused import detection with warning generation
   - Disabled symbol import error handling (`SYLANG_DISABLED_IMPORT`)
   - Child symbol usage detection for import marking
   - Nested hierarchy support for import resolution

6. **RelationshipValidator** (`src/core/relationshipValidator.ts`):
   - Strict relationship target type validation
   - Config-aware relationship validation with skip logic
   - File type restrictions for relation usage
   - Extensible relationship rule definitions

7. **DiagramManager** (`src/diagrams/core/diagramManager.ts`):
   - Multi-diagram type orchestration (Feature Model, Graph Traversal, IBD, Trace Table)
   - Webview lifecycle management with real-time updates
   - Performance optimization with dual rendering systems

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

### Current Implementation Scope (v2.9.77)

> **⚠️ IMPORTANT FOR AI DEVELOPERS**
> 
> **FULLY IMPLEMENTED (7 Extensions)**: The current VSCode extension completely implements and validates these file types:
> - **Product Line**: `.ple`, `.fml`, `.vml`, `.vcf` 
> - **Systems Engineering**: `.blk`, `.fun`, `.req`, `.tst`
> 
> **ADVANCED FEATURES IMPLEMENTED**:
> - **Configuration-Based Validation**: Complete config propagation system with visual graying
> - **Comprehensive Diagramming**: Feature models, Graph traversal, Internal Block Diagrams, Trace tables
> - **Performance Optimizations**: Dual rendering systems, static SVG, infinite canvas
> - **Enhanced User Experience**: Light mode, drag/zoom/pan, color-coded visualizations
> - **Multi-line String Support**: Backslash continuation for long property values
> - **Robust Symbol Management**: Hierarchical inheritance, cross-file validation, import detection
> 
> **PLANNED FOR FUTURE**: These extensions are specified but NOT YET IMPLEMENTED:
> - **Systems Analysis**: `.fma`, `.fmc`, `.fta`
> - **Safety Analysis**: `.itm`, `.haz`, `.rsk`, `.sgl` 
> - **General**: `.enm`
> 
> **CURRENT VERSION CAPABILITIES**: v2.9.77 provides production-ready systems engineering workflow support with advanced diagramming, config management, and validation features. The architecture is designed to easily extend to the remaining extensions once the core functionality is stable and tested.

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

#### Diagrams (v2.9.77)
Extending this extension to work on webview. We need some system architecture diagrams. Currently we support 7 extensions, and we need diagrams for Featuremodel, variant model, blocks, and graph traversal as the first step. Also we need an extension graph traversal diagrams, that basically shows all nodes and relations. hdef and def are the nodes, and relation keywords are edges between those nodes.

##### How does the diagrams are opened?
In the left project tree structure of vscode - clicking .fml, .vml, .blk shall open a diagram - not the editor. Right click and edit shall open the file in the editor panel. The diagram has to be opened in the full window of editor panel, not the default split window.

##### Implemented Diagram Features (v2.9.77):
**1. Feature Model Diagrams (.fml)** ✅ IMPLEMENTED
- Hierarchical tree visualization with parent-child relationships
- Constraint indicators (mandatory: solid circles, optional: empty circles)
- Color-coded node types with distinct visual styles
- Interactive zoom, pan, and node highlighting
- Config-aware graying for disabled features

**2. Graph Traversal (.all files)** ✅ IMPLEMENTED  
- Neo4j-style graph showing all symbols and relationships
- Force-directed layout with curved edges and directional arrows
- Color-coded nodes by type (Feature: Blue, Config: Ruby, Requirement: Green, etc.)
- Configurable rendering (D3.js vs Static SVG for performance)
- Full node labels without truncation
- Legend display (toggleable)
- Pan/zoom with infinite canvas support
- Click-to-highlight and auto-centering

**3. Internal Block Diagrams (.blk)** ✅ IMPLEMENTED (v2.9.76+)
- System boundary with input/output ports
- Internal blocks from `composedof` relationships  
- Port positioning on block edges (input left, output right)
- Port connections based on `needs ref port` relationships
- Light mode interface for better diagram visibility
- Grid layout for internal block positioning
- Drag functionality for blocks with pan/zoom support

**4. Trace Table Component** ✅ IMPLEMENTED (v2.9.70+)
- Hierarchical traceability table showing symbol relationships
- Product line → featureset → feature → functions → requirements → tests flow
- Tabular format for easy navigation and analysis

**Commands Added**:
- `sylang.showFeatureModelDiagram` - Opens .fml diagram
- `sylang.showGraphTraversal` - Opens graph traversal view
- `sylang.showInternalBlockDiagram` - Opens .blk Internal Block Diagram  
- `sylang.showTraceTable` - Opens traceability table 

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

##### 3. Internal Block Diagrams (.blk) ✅ IMPLEMENTED (v2.9.76+)
**Purpose**: System architecture visualization showing focused block with its internal structure

**Layout Algorithm**: **Grid Layout for Internal Blocks**
- **Main Block**: System boundary positioned as large container
- **Internal Block Positioning**: Grid-based layout for `composedof` blocks inside main block
- **Port Placement**: Input ports on left edge, output ports on right edge of blocks
- **Connection Routing**: Direct lines between matching ports based on `needs ref port`
- **Auto-sizing**: Blocks sized to accommodate port names and content

**Visual Elements**:
- **System Boundary**: Large rectangle representing the main block (from .blk file)
- **Internal Blocks**: Smaller rectangles positioned inside system boundary
- **Input Ports**: Small rectangles on left edges (from `needs ref port` statements)
- **Output Ports**: Small rectangles on right edges (from `def port` statements)  
- **Port Labels**: Port names displayed inside blocks near edges
- **Connections**: Lines connecting output ports to input ports where `needs ref port` matches
- **Interactive Features**: Drag blocks, pan/zoom canvas, light mode interface

**Implementation Details**:
- **Data Parsing**: Extracts `composedof ref block` to find internal blocks
- **Port Extraction**: Processes `needs ref port` and `def port` statements
- **Connection Logic**: Matches port names to create meaningful connections
- **Grid Positioning**: Auto-arranges internal blocks in grid inside main container

##### 4. Extension Graph Traversal (.all) ✅ IMPLEMENTED (v2.9.77)
**Purpose**: Neo4j-style graph showing all symbols and relationships across the project

**Layout Algorithm**: **Configurable Dual Rendering System**
- **D3.js Force-Directed**: Dynamic force simulation for interactive exploration
- **Static SVG Layout**: High-performance static rendering for large graphs
- **Node Positioning**: Left-to-right hierarchical layout with forces for spacing
- **Edge Routing**: Curved edges with directional arrows to avoid overlaps
- **Zoom/Pan**: Infinite canvas with smooth zoom and pan controls
- **Performance Target**: Handles thousands of nodes efficiently

**Visual Elements (Enhanced v2.9.50+)**:
- **Color-Coded Nodes**: 
  - Product Line/Feature Set/Function Set/Requirement Set/Test Set: Orange
  - Feature: Blue  
  - Config Symbols (c_ prefix): Ruby
  - Requirement: Green
  - Test: Purple
  - Block: Teal
  - Port: Gold
  - Function: Pink
- **Full Node Labels**: Complete names without truncation, proper node types displayed
- **Relationship Edges**: Curved arrows with labels and proper directional flow
- **Interactive Features**: 
  - Click-to-highlight with red focus
  - Auto-centering on selected nodes
  - Drag functionality with connected nodes following
  - Configurable legend (hidden by default)
- **Performance Optimizations**: Static rendering mode for large graphs, infinite canvas without clipping

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

##### Phase 2: Feature Model Diagrams (Week 2) ✅ **COMPLETED**
1. ✅ Implement hierarchical tree layout algorithm with orientation options
2. ✅ Create feature model diagram renderer (.fml) with constraint visualization
3. ✅ Build Preact components for tree visualization with proper constraint indicators
4. ✅ Add symbol data transformation for feature models
5. ✅ Implement cross-feature relationship arrows (requires/excludes)

##### Phase 3: Advanced Diagrams (Week 3) ✅ **COMPLETED**
1. ✅ Implement force-directed layout algorithm with configurable dual rendering
2. ✅ Add graph traversal renderer (.all) with Neo4j-style visualization
3. ✅ Create Internal Block Diagram renderer (.blk) with grid layout and port connections
4. ✅ Implement real-time update system with performance optimizations
5. ✅ Add Trace Table component for hierarchical traceability analysis

##### Phase 4: Enhanced Features (Week 4) ✅ **COMPLETED**
1. ✅ Implement extension graph traversal renderer with color-coded nodes
2. ✅ Add comprehensive zoom, pan, and drag functionality for all diagrams
3. ✅ Create sophisticated IBD with `composedof` parsing and port connections
4. ✅ Optimize rendering performance with static SVG and D3.js options
5. ✅ Add light mode interface and infinite canvas support

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

---

## 🔧 Sylang Extension System (.sylangextend)

### Overview

The Sylang Extension System allows users to extend existing Sylang file types with additional properties, relations, and enums, or create entirely new file types. This system uses a `.sylangextend` file placed in the project root to define extensions using a Python-like indentation syntax.

### File Structure

A `.sylangextend` file uses indentation-based syntax without braces, following Sylang's design philosophy:

```sylang
// .sylangextend - Sylang Language Extensions

// Create completely new file types
def file .fma failureanalysis
  def blocktype header failureanalysis
    property methodology single
    property safetylevel single
    enum methodology fmea fta hazop
    enum safetylevel critical high medium low
    
  def blocktype definition failure
    property severity single
    property probability single
    property detectability single
    relation causedby requirement multiple
    enum severity catastrophic critical marginal negligible

// Extend existing file types
extend file .req
  ref blocktype header requirementset
    property safetylevel single
    property verification single
    enum safetylevel asild asilc asilb asila
    
  ref blocktype definition requirement
    property fmeascore single
    property safetycriticality single
    relation triggersFailure failure multiple

extend file .blk
  ref blocktype header block
    property failuretolerance single
    enum failuretolerance none single dual triple
    
  ref blocktype definition port
    property safetymechanism single
    enum safetymechanism crc timeout watchdog ecc
```

### Syntax Rules

#### 1. File Type Definitions

**Creating New File Types:**
```sylang
def file <extension> <header-keyword>
```
- `<extension>`: New file extension (e.g., `.fma`, `.haz`)
- `<header-keyword>`: Header definition keyword for the new file type

**Extending Existing File Types:**
```sylang
extend file <extension>
```
- `<extension>`: Existing file extension (e.g., `.req`, `.blk`)

#### 2. Block Type Definitions

**Header Block Types (for `hdef` statements):**
```sylang
def blocktype header <name>
  // Properties and relations for header blocks
```

**Definition Block Types (for `def` statements):**
```sylang
def blocktype definition <name>
  // Properties and relations for definition blocks
```

**Referencing Existing Block Types:**
```sylang
ref blocktype header <name>
  // Additional properties and relations for existing header blocks

ref blocktype definition <name>
  // Additional properties and relations for existing definition blocks
```

#### 3. Property Definitions

**Single Value Properties:**
```sylang
property <name> single
```

**Multiple Value Properties:**
```sylang
property <name> multiple
```

#### 4. Relation Definitions

**Single Target Relations:**
```sylang
relation <name> <target-type> single
```

**Multiple Target Relations:**
```sylang
relation <name> <target-type> multiple
```

#### 5. Enum Definitions

```sylang
enum <property-name> <value1> <value2> <value3>
```

### Universal Properties

All `hdef` and `def` blocks automatically include these universal properties:
- `name` - Display name (supports multiline)
- `description` - Detailed description (supports multiline) 
- `owner` - Owner/responsible party
- `tags` - Classification tags (multiple values)
- `status` - Status enum (draft, review, approved, deprecated, implemented)

### Validation Rules

1. **Block Type Matching**: When extending existing file types, block type names must match exactly with existing types
2. **Mandatory Block Types**: All extensions must explicitly specify block types (`header` vs `definition`)
3. **Universal Properties**: Universal properties are automatically available and don't need to be redefined
4. **Property Scoping**: Properties and relations are scoped to specific block types
5. **Multiple Definitions**: Multiple definition block types per file type are allowed

### Configuration Control

Extensions can be toggled via configuration:

```json
{
  "sylang.extensions.enabled": true,
  "sylang.extensions.allowNewFileTypes": true,
  "sylang.extensions.validateExtensions": true
}
```

### Example Use Cases

#### 1. Failure Mode Analysis Extension

```sylang
// Create .fma file type for Failure Mode Analysis
def file .fma failureanalysis
  def blocktype header failureanalysis
    property methodology single
    property scope single
    enum methodology fmea fta hazop bow-tie
    
  def blocktype definition failure
    property severity single
    property probability single
    property detectability single
    property rpn single
    relation causedby requirement multiple
    relation mitigatedby control multiple
    enum severity catastrophic critical marginal negligible

// Extend requirements to reference failures
extend file .req
  ref blocktype definition requirement
    relation triggersFailure failure multiple
    relation preventedby control multiple

// Extend blocks to include failure modes
extend file .blk
  ref blocktype definition port
    relation hasFailureModes failure multiple
    property mtbf single
```

#### 2. Safety Analysis Extension

```sylang
// Create .haz file type for Hazard Analysis
def file .haz hazardanalysis
  def blocktype header hazardanalysis
    property standard single
    property assessmentdate single
    enum standard iso26262 iec61508 do178c
    
  def blocktype definition hazard
    property severity single
    property exposure single
    property controllability single
    property asil single
    relation causedby failure multiple
    relation mitigatedby safetymechanism multiple
    enum severity s0 s1 s2 s3
    enum exposure e0 e1 e2 e3 e4
    enum controllability c0 c1 c2 c3
    enum asil qm asila asilb asilc asild

// Extend existing types to reference hazards
extend file .req
  ref blocktype definition requirement
    relation addresses hazard multiple
    relation derivedFromHazard hazard single

extend file .blk
  ref blocktype definition block
    relation exposedToHazard hazard multiple
    property safetylevel single
```

### Integration Points

1. **Keyword Manager**: Extended keywords are integrated into the main keyword system
2. **Validation Engine**: Extensions are validated using the same rules as core language
3. **Symbol Manager**: Extended symbols are managed alongside core symbols
4. **Diagram System**: Extended file types can participate in diagrams
5. **DocView**: Extended properties appear in DocView panels

### File Generation

Use the command palette to generate a template `.sylangextend` file:
- **Command**: `Sylang: Create Extension Template`
- **Location**: Project root directory
- **Content**: Template with examples for common extension patterns

---

## 🚀 AI Integration Architecture

### Overview

The AI Integration Architecture extends the Sylang extension with automated AI-driven development workflows, enabling seamless integration with Cursor AI for intelligent systems engineering assistance.

### 🔍 Discovery Findings

#### Cursor AI Structure
- **Cursor IDE**: VSCode fork with native AI integration (not an extension)
- **Built-in AI**: Native chat, composer, and tab completion
- **Command-based API**: Standard VSCode `executeCommand` interface
- **Keyboard Shortcuts**: `Ctrl+L` (chat), `Ctrl+K` (edit), `Ctrl+I` (composer)

#### Key Integration Points
1. **VSCode Commands API**: `vscode.commands.executeCommand()`
2. **Chat Panel Control**: Standard workbench panel management
3. **Text/Context Injection**: Clipboard, file system, editor APIs
4. **File Context Sharing**: VSCode workspace and editor APIs

### 🏗️ Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 SYLANG AI ORCHESTRATION PLATFORM               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Human Interface │  │ JSON Generator  │  │ AI Trigger      │ │
│  │ (VSCode Cmds)   │  │ (Agent Schemas) │  │ (Cursor API)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Task Manager    │  │ Workflow Engine │  │ Context Manager │ │
│  │ (State/Queue)   │  │ (Orchestration) │  │ (Sylang Files)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 📋 Component Specifications

#### 1. Human System Integrator Interface

**Purpose**: Right-click commands for triggering AI workflows

```typescript
interface HumanInterfaceCommands {
  // Right-click menu commands
  'sylang.ai.refineWithScrumMaster': (fileUri: vscode.Uri) => Promise<void>;
  'sylang.ai.startSprintWithAgents': (projectUri: vscode.Uri) => Promise<void>;
  'sylang.ai.executeTaskWithSME': (taskDef: TaskDefinition) => Promise<void>;
  'sylang.ai.reviewAndApprove': (content: GeneratedContent) => Promise<void>;
}

// Context menu configuration
const contextMenus = {
  "explorer/context": [
    {
      "command": "sylang.ai.refineWithScrumMaster",
      "when": "resourceExtname == .ple || resourceExtname == .req",
      "group": "ai@1"
    }
  ]
};
```

#### 2. JSON Orchestration Engine

**Purpose**: Generate structured instructions for AI agents

```typescript
interface AgentInstruction {
  role: 'ScrumMaster' | 'SMEAgent' | 'ArchitectAgent';
  context: SylangContext;
  task: TaskDefinition;
  constraints: string[];
  expectedOutput: OutputSpecification;
  followUpActions: string[];
}

interface ScrumMasterInstruction extends AgentInstruction {
  role: 'ScrumMaster';
  task: {
    type: 'requirement-refinement' | 'sprint-planning' | 'backlog-management';
    input: string | SylangFile[];
    deliverables: ('epics' | 'user-stories' | 'tasks' | 'acceptance-criteria')[];
  };
}

class JSONOrchestrationEngine {
  generateScrumMasterInstruction(requirements: string[]): ScrumMasterInstruction {
    return {
      role: 'ScrumMaster',
      context: this.buildSylangContext(),
      task: {
        type: 'requirement-refinement',
        input: requirements,
        deliverables: ['user-stories', 'acceptance-criteria']
      },
      constraints: [
        'Use Sylang syntax for all deliverables',
        'Maintain traceability between requirements and stories',
        'Follow agile best practices',
        'Include estimation in story points'
      ],
      expectedOutput: {
        format: 'sylang-files',
        fileTypes: ['.req', '.ple'],
        structure: 'hierarchical'
      },
      followUpActions: [
        'Create technical tasks with SME agents',
        'Generate test scenarios',
        'Update project documentation'
      ]
    };
  }
}
```

#### 3. Cursor AI Trigger System

**Purpose**: Programmatically control Cursor AI chat/composer

```typescript
class CursorAIIntegrator {
  private discoveredCommands: string[] = [];
  
  async initialize(): Promise<void> {
    // Discover available commands
    this.discoveredCommands = await vscode.commands.getCommands();
    
    // Find Cursor-specific commands
    const cursorCommands = this.discoveredCommands.filter(cmd => 
      cmd.includes('chat') || 
      cmd.includes('composer') || 
      cmd.includes('workbench.action')
    );
    
    this.logger.info(`Found ${cursorCommands.length} potential Cursor commands`);
  }
  
  async triggerCursorChat(): Promise<boolean> {
    // Priority order of commands to try
    const chatTriggers = [
      'workbench.action.chat.open',
      'workbench.view.chat',
      'workbench.panel.chat.focus',
      'workbench.action.toggleSidebarVisibility' // Fallback
    ];
    
    for (const command of chatTriggers) {
      try {
        await vscode.commands.executeCommand(command);
        this.logger.info(`✅ Successfully triggered chat with: ${command}`);
        return true;
      } catch (error) {
        this.logger.debug(`❌ Command failed: ${command} - ${error.message}`);
        continue;
      }
    }
    
    return false;
  }
  
  async injectAgentInstruction(instruction: AgentInstruction): Promise<void> {
    // Strategy 1: Clipboard injection
    const jsonInstruction = JSON.stringify(instruction, null, 2);
    const prompt = `Please act as a ${instruction.role} and help me with the following task:\n\n\`\`\`json\n${jsonInstruction}\n\`\`\`\n\nPlease analyze the context and deliver the requested output following the specified constraints.`;
    
    await vscode.env.clipboard.writeText(prompt);
    
    // Strategy 2: Create temporary instruction file
    const tempFile = await this.createTempInstructionFile(instruction);
    await vscode.window.showTextDocument(tempFile);
    
    // Strategy 3: Show information message with instruction
    const action = await vscode.window.showInformationMessage(
      `AI Instruction ready for ${instruction.role}. Paste in chat and add context files.`,
      'Open Chat', 'Copy Instruction'
    );
    
    if (action === 'Open Chat') {
      await this.triggerCursorChat();
    } else if (action === 'Copy Instruction') {
      await vscode.env.clipboard.writeText(prompt);
    }
  }
  
  async attachSylangContext(files: vscode.Uri[]): Promise<void> {
    // Create context summary for AI
    const contextText = await Promise.all(
      files.map(async (uri) => {
        const content = await vscode.workspace.fs.readFile(uri);
        const textContent = Buffer.from(content).toString('utf8');
        return `// File: ${uri.fsPath}\n${textContent}`;
      })
    );
    
    const fullContext = `Please use the following Sylang files as context:\n\n${contextText.join('\n\n')}`;
    
    // Copy to clipboard for easy pasting
    await vscode.env.clipboard.writeText(fullContext);
    
    // Optional: Create workspace file with context
    const contextUri = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders![0].uri, 
      '.ai-context',
      `context-${Date.now()}.md`
    );
    
    await vscode.workspace.fs.writeFile(
      contextUri, 
      Buffer.from(fullContext, 'utf8')
    );
    
    await vscode.window.showTextDocument(contextUri);
  }
}
```

#### 4. Task State Manager

**Purpose**: Track AI workflow progress and orchestrate multi-step tasks

```typescript
interface TaskDefinition {
  id: string;
  type: 'scrum-master' | 'sme-development' | 'testing' | 'review';
  status: 'pending' | 'in-progress' | 'waiting-human' | 'completed' | 'failed';
  priority: number;
  dependencies: string[];
  assignedAgent: AgentRole;
  context: SylangContext;
  instruction: AgentInstruction;
  expectedOutputs: string[];
  createdAt: Date;
  updatedAt: Date;
}

class TaskStateManager {
  private tasks: Map<string, TaskDefinition> = new Map();
  private taskQueue: string[] = [];
  
  async createTask(instruction: AgentInstruction): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task: TaskDefinition = {
      id: taskId,
      type: this.mapRoleToTaskType(instruction.role),
      status: 'pending',
      priority: 1,
      dependencies: [],
      assignedAgent: instruction.role,
      context: instruction.context,
      instruction,
      expectedOutputs: this.extractExpectedOutputs(instruction),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.tasks.set(taskId, task);
    this.taskQueue.push(taskId);
    
    await this.persistTaskState();
    return taskId;
  }
  
  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    // Update status
    task.status = 'in-progress';
    task.updatedAt = new Date();
    
    // Trigger AI
    await this.aiIntegrator.triggerCursorChat();
    await this.aiIntegrator.injectAgentInstruction(task.instruction);
    await this.aiIntegrator.attachSylangContext(task.context.files);
    
    // Set up file watchers for completion detection
    await this.setupCompletionWatchers(task);
    
    // Show progress notification
    vscode.window.showInformationMessage(
      `🤖 AI Agent (${task.assignedAgent}) is working on: ${task.type}`,
      'View Progress', 'Cancel Task'
    );
  }
  
  async markTaskCompleted(taskId: string, outputs: vscode.Uri[]): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.status = 'completed';
    task.updatedAt = new Date();
    
    // Process outputs and trigger next tasks
    await this.processTaskOutputs(task, outputs);
    await this.triggerDependentTasks(taskId);
    
    // Notify user
    vscode.window.showInformationMessage(
      `✅ Task completed: ${task.type}`,
      'View Results', 'Start Next Task'
    );
  }
}
```

#### 5. Workflow Orchestration Engine

**Purpose**: Coordinate multi-agent workflows

```typescript
class WorkflowOrchestrator {
  async startSprintWorkflow(requirements: string[]): Promise<void> {
    // Step 1: Create Scrum Master task
    const scrumMasterInstruction = this.jsonEngine.generateScrumMasterInstruction(requirements);
    const scrumTaskId = await this.taskManager.createTask(scrumMasterInstruction);
    
    // Step 2: Execute Scrum Master task
    await this.taskManager.executeTask(scrumTaskId);
    
    // Step 3: Wait for completion (human approval)
    await this.waitForTaskCompletion(scrumTaskId);
    
    // Step 4: Generate SME tasks based on stories
    const stories = await this.extractUserStories(scrumTaskId);
    const smeTasks = await this.generateSMETasks(stories);
    
    // Step 5: Execute SME tasks in parallel or sequence
    for (const smeTask of smeTasks) {
      const taskId = await this.taskManager.createTask(smeTask);
      await this.taskManager.executeTask(taskId);
    }
    
    // Step 6: Monitor progress and handle dependencies
    await this.monitorWorkflowProgress(smeTasks.map(t => t.id));
  }
  
  async generateSMETasks(stories: UserStory[]): Promise<AgentInstruction[]> {
    return stories.map(story => ({
      role: 'SMEAgent',
      context: this.buildContextForStory(story),
      task: {
        type: 'technical-implementation',
        input: story,
        deliverables: ['code', 'tests', 'documentation']
      },
      constraints: [
        'Follow Sylang coding standards',
        'Include comprehensive tests',
        'Update relevant documentation',
        'Ensure backward compatibility'
      ],
      expectedOutput: {
        format: 'code-files',
        fileTypes: ['.ts', '.test.ts', '.md'],
        structure: 'modular'
      },
      followUpActions: [
        'Code review',
        'Integration testing',
        'Documentation update'
      ]
    }));
  }
}
```

### 🚀 Implementation Plan

#### Phase 1: Discovery & Basic Integration (Week 1-2)
1. **Run Discovery Script** - Execute command discovery in Cursor extension context
2. **Identify Working Commands** - Find exact command IDs for chat/composer
3. **Build Basic Trigger** - Create simple command to open chat + inject text
4. **Test File Context** - Verify file attachment capabilities

#### Phase 2: JSON Agent System (Week 3-4)
1. **Agent Schema Design** - Implement JSON schemas for each agent role
2. **Instruction Generator** - Build system to create agent instructions
3. **Context Manager** - Develop Sylang file context extraction
4. **Basic Workflow** - Single agent (Scrum Master) proof of concept

#### Phase 3: Multi-Agent Orchestration (Week 5-6)
1. **Task State Management** - Implement task queue and state tracking
2. **Workflow Engine** - Build multi-step task orchestration
3. **Progress Monitoring** - Add completion detection and notifications
4. **Error Handling** - Implement robust error recovery

#### Phase 4: Production Features (Week 7-8)
1. **Human Approval Gates** - Add review and approval workflows
2. **Advanced Context** - Implement smart context selection
3. **Performance Optimization** - Add caching and efficiency improvements
4. **Documentation** - Complete user guides and API docs

### 🔧 Integration Strategies

#### Strategy 1: Clipboard + Manual Paste
```typescript
async injectInstruction(instruction: AgentInstruction): Promise<void> {
  const prompt = this.formatInstructionAsPrompt(instruction);
  await vscode.env.clipboard.writeText(prompt);
  await this.triggerCursorChat();
  
  vscode.window.showInformationMessage(
    'AI instruction copied to clipboard. Paste in Cursor chat and add @files for context.',
    'Done'
  );
}
```

#### Strategy 2: Temporary File + Auto-Open
```typescript
async injectViaFile(instruction: AgentInstruction): Promise<void> {
  const tempUri = await this.createTempInstructionFile(instruction);
  await vscode.window.showTextDocument(tempUri);
  await this.triggerCursorChat();
  
  // Optional: Auto-delete after use
  setTimeout(() => vscode.workspace.fs.delete(tempUri), 60000);
}
```

#### Strategy 3: Context Window + File Refs
```typescript
async attachContext(files: vscode.Uri[]): Promise<void> {
  // Create context file with file references
  const contextContent = files.map(uri => `@${uri.fsPath}`).join('\n');
  const contextUri = await this.createContextFile(contextContent);
  
  await vscode.window.showTextDocument(contextUri);
  await this.triggerCursorChat();
}
```

### 📊 Expected Outcomes

#### Immediate Benefits
- **Right-click AI Workflows** - Instant access to AI agents from file explorer
- **Structured AI Instructions** - Consistent, high-quality AI prompts
- **Context-Aware AI** - AI agents understand Sylang project structure
- **Progress Tracking** - Visual feedback on multi-step AI workflows

#### Long-term Value
- **Automated Development** - AI-driven sprint execution
- **Quality Assurance** - Consistent deliverable formats
- **Knowledge Capture** - Reusable agent templates and workflows
- **Team Scaling** - Standardized AI-assisted development processes

### 🧪 Discovery Approach

Since the JavaScript console doesn't have access to VSCode APIs, the discovery needs to be done through extension context. The recommended approach is:

1. **Extension-based Discovery** - Create a temporary extension command for discovery
2. **Command Palette Testing** - Manual testing of likely commands via `Ctrl+Shift+P`
3. **Keyboard Shortcut Analysis** - Test documented Cursor shortcuts programmatically
4. **Incremental Implementation** - Start with basic clipboard strategy, then enhance

This architecture provides a solid foundation for command-based AI integration while remaining completely separate from existing Sylang extension functionality and easily removable if needed.

## Use Case Diagram (.ucd) Language Specification

### Overview
Use Case Diagrams in Sylang visualize interactions between actors and system functions, showing both direct associations (solid lines) and include relationships (dotted lines). Each .ucd file represents a single use case with multiple actors and their associated functions.

### File Structure Rules
- **One use case per file** - Each .ucd file represents a single use case scenario
- **Multiple .ucd files allowed** - Different use cases can be defined in separate files
- **Function hierarchy** - Primary actors can have nested function hierarchies using indentation
- **Secondary actor constraints** - Secondary actors can only be associated with tail-end functions

### Allowed Keywords

| Keyword | Type |
|---------|------|
| hdef | header definition |
| usecase | <header-def-keyword> |
| def | definition |
| actor | <def-keyword> |
| name | <property> |
| description | <property> |
| owner | <property> |
| tags | <property> |
| associated | <relation-keyword> |
| includes | <relation-keyword> |
| ref | reference |
| use | import |
| actortype | <enum> |

### Enums

| Enum | Values |
|------|--------|
| actortype | primary, secondary |

### Relationship Types

#### Associated Relationships (Solid Lines)
- **Purpose**: Direct ownership or triggering relationship between actor and function
- **Visual**: Solid lines in diagram
- **Usage**: `associated ref function FunctionName`
- **Hierarchy**: Can be nested using indentation to show function hierarchies

#### Includes Relationships (Dotted Lines)
- **Purpose**: Functional dependency where one function includes another
- **Visual**: Dotted lines in diagram
- **Usage**: `includes ref function FunctionName`
- **Context**: Used within function hierarchies to show dependencies

### Actor Types

#### Primary Actors
- **Definition**: Main users who derive value from the system
- **Capabilities**: Can have hierarchical associated functions with unlimited nesting
- **Relationship mixing**: Can mix `associated` and `includes` within the same hierarchy
- **Visual placement**: Typically rendered on the left side of use case diagrams

#### Secondary Actors
- **Definition**: Supporting systems or external services
- **Constraints**: Can only be associated with tail-end (deepest level) functions
- **Limitations**: Cannot have nested function hierarchies
- **Visual placement**: Typically rendered on the right side of use case diagrams

### Hierarchical Function Relationships

Functions can be nested using indentation to create hierarchical relationships:

```sylang
associated ref function ParentFunction
  includes ref function DependentFunction      // Dotted line
  associated ref function ChildFunction        // Solid line
    associated ref function GrandchildFunction // Solid line
```

This creates:
- Actor → ParentFunction (solid line)
- ParentFunction → DependentFunction (dotted line)
- ParentFunction → ChildFunction (solid line)
- ChildFunction → GrandchildFunction (solid line)

### Sample Code

```sylang
// AutomotiveHMI.ucd
use functionset EngineControlFunctions
use functionset DisplayFunctions
use functionset DiagnosticFunctions

hdef usecase AutomotiveHMI
  name "Automotive HMI System"
  description "Human-machine interface for automotive applications"
  owner "HMI Engineering Team"
  tags "automotive", "hmi", "user-interface"

  def actor Driver
    name "Primary Driver"
    description "Main vehicle operator"
    owner "User Experience Team"
    tags "primary-user", "operator"
    actortype primary
    associated ref function StartEngine
      includes ref function ValidateCredentials
      associated ref function DisplaySpeed
        associated ref function MonitorDiagnostics
          includes ref function UpdateSoftware
          includes ref function EmergencyCall

  def actor Passenger
    name "Vehicle Passenger"
    description "Secondary user with entertainment access"
    actortype primary
    associated ref function PlayMedia
      associated ref function AdjustVolume
      includes ref function StreamContent

  def actor VehicleECU
    name "Vehicle Electronic Control Unit"
    description "Central vehicle computer system"
    actortype secondary
    associated ref function EmergencyCall
    associated ref function UpdateSoftware

  def actor NavigationSystem
    name "GPS Navigation System"
    description "External navigation service"
    actortype secondary
    associated ref function UpdateMapData
```

### Validation Rules

#### General Validation
- Use Case file (.ucd) shall only contain keywords specified above
- Only one `hdef usecase` statement allowed per file
- `use` statements must appear before `hdef` statement
- Indentation must be multiples of 2 spaces or tabs
- All referenced functions must exist in imported function sets

#### Actor Type Validation
- `actortype primary`: Can have unlimited nested function hierarchies
- `actortype secondary`: Can only associate with tail-end functions (no nesting allowed)
- Actor names must be unique within the use case

#### Relationship Validation
- `associated` relationships create solid lines in diagrams
- `includes` relationships create dotted lines in diagrams
- Both relationship types can be mixed within the same function hierarchy
- Referenced functions must exist in imported function sets via `use` statements

#### Hierarchy Validation
- Function hierarchies are defined through indentation levels
- Parent-child relationships must be properly nested
- Secondary actors cannot have nested function relationships
- Include relationships can only reference functions at the same or deeper indentation levels

### Error Handling

#### Common Validation Errors
- `SYLANG_UCD_INVALID_ACTOR_TYPE`: Invalid actortype value
- `SYLANG_UCD_SECONDARY_ACTOR_HIERARCHY`: Secondary actor with nested functions
- `SYLANG_UCD_UNRESOLVED_FUNCTION`: Referenced function not found in imports
- `SYLANG_UCD_INVALID_INDENTATION`: Incorrect indentation levels
- `SYLANG_UCD_MISSING_USE_STATEMENT`: Function reference without proper import
- `SYLANG_UCD_DUPLICATE_ACTOR`: Multiple actors with same name

### Integration with Existing Sylang

#### Cross-File References
- Use Case files reference functions from `.fun` files via `use functionset` statements
- Function validation ensures all referenced functions exist in the project
- Proper symbol resolution through existing Sylang symbol management system

#### Relationship to Other File Types
- `.ucd` files complement `.fun` files by showing user interactions
- Use cases can reference functions that are allocated to blocks (`.blk` files)
- Requirements (`.req` files) may derive from use case scenarios

### Future Extensions

#### Planned Enhancements
- **Use Case Extensions**: Support for `extends` relationships between use cases
- **Preconditions/Postconditions**: Optional scenario documentation
- **Alternative Flows**: Support for exception and alternative scenarios
- **Stereotypes**: Actor and function stereotyping for specialized domains 