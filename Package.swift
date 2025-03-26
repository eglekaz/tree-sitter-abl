// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "TreeSitterAbl",
    products: [
        .library(name: "TreeSitterAbl", targets: ["TreeSitterAbl"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ChimeHQ/SwiftTreeSitter", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterAbl",
            dependencies: [],
            path: ".",
            sources: [
                "src/parser.c",
                // NOTE: if your language has an external scanner, add it here.
            ],
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterAblTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterAbl",
            ],
            path: "bindings/swift/TreeSitterAblTests"
        )
    ],
    cLanguageStandard: .c11
)
