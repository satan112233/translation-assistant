# Place Sherpa-onnx Windows binaries here

Required files:
- sherpa-onnx-offline.exe
- Required DLL dependencies (onnxruntime, etc.)

Optional bundled model (avoids runtime download):
- sherpa-onnx-paraformer-zh-small-2024-03-09/
  - tokens.txt
  - model.int8.onnx

These files will be packaged into the installer via extraResources.
