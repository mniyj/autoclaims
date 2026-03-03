# Bugfix Requirements Document

## Introduction

After submitting a claim report (报案), the system displays a network error message "网络连接似乎有些问题，请稍后再试。" instead of showing the required materials list (材料清单). This occurs because the current implementation relies on the `enableDynamicCalculation` configuration to pre-calculate materials, which results in an empty `calculatedMaterials` array when this feature is disabled. This bug prevents users from knowing what documents they need to submit for their claim, blocking the claims workflow.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a claim report is submitted AND the product does not have `enableDynamicCalculation` enabled THEN the system displays error message "网络连接似乎有些问题，请稍后再试。" instead of the materials list

1.2 WHEN a claim report is submitted AND `calculatedMaterials` is empty due to missing `enableDynamicCalculation` config THEN the system fails to show the required materials list modal

### Expected Behavior (Correct)

2.1 WHEN a claim report is submitted AND the product does not have `enableDynamicCalculation` enabled THEN the system SHALL make an explicit API call to fetch the materials list and display it in a modal

2.2 WHEN a claim report is submitted successfully THEN the system SHALL display the required materials list regardless of the `enableDynamicCalculation` configuration status

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a claim report is submitted AND the product has `enableDynamicCalculation` enabled THEN the system SHALL CONTINUE TO use the pre-calculated materials list if available

3.2 WHEN a claim report submission fails due to validation errors THEN the system SHALL CONTINUE TO display appropriate validation error messages

3.3 WHEN the materials list API call returns an empty array THEN the system SHALL CONTINUE TO handle this gracefully with an appropriate user message

3.4 WHEN a user cancels the claim report submission THEN the system SHALL CONTINUE TO not fetch or display the materials list
