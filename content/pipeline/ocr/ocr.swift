// Lokální OCR přes macOS Vision: vypíše JSON [{text, x, y, w, h}] v relativních
// souřadnicích obrázku (počátek vlevo NAHOŘE). Nic neposílá ven.
// Použití: swift ocr.swift <obrázek.png> [de-DE]
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 2, let image = NSImage(contentsOfFile: args[1]),
      let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("nelze načíst obrázek\n".data(using: .utf8)!)
  exit(2)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = [args.count >= 3 ? args[2] : "de-DE"]
request.usesLanguageCorrection = false
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
var out: [[String: Any]] = []
for obs in request.results ?? [] {
  guard let cand = obs.topCandidates(1).first else { continue }
  let b = obs.boundingBox  // Vision: počátek vlevo DOLE
  out.append(["text": cand.string, "x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height])
}
let data = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
