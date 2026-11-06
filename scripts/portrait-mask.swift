// Makes src/assets/hero-mask.png with Apple Vision. Rerun after replacing hero.jpg (macOS only):
// swift scripts/portrait-mask.swift src/assets/hero.jpg src/assets/hero-mask.png
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
guard let image = CIImage(contentsOf: input) else { print("cannot read"); exit(1) }

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
let handler = VNImageRequestHandler(ciImage: image, options: [:])
try handler.perform([request])
guard let result = request.results?.first else { print("no person"); exit(2) }

var mask = CIImage(cvPixelBuffer: result.pixelBuffer)
let sx = image.extent.width / mask.extent.width, sy = image.extent.height / mask.extent.height
mask = mask.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
let context = CIContext()
try context.writePNGRepresentation(of: mask, to: output, format: .L8,
  colorSpace: CGColorSpace(name: CGColorSpace.linearGray)!)
print("mask", Int(image.extent.width), Int(image.extent.height))
