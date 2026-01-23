use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Get the project root (parent of src-tauri)
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
    let project_root = PathBuf::from(&manifest_dir).parent().unwrap().to_path_buf();
    let rayforce_dir = project_root.join("rayforce");

    println!("cargo:rerun-if-changed=../rayforce/core/");
    println!("cargo:rerun-if-changed=../rayforce/Makefile");

    // Build Rayforce static library
    println!("cargo:warning=Building librayforce.a from {:?}", rayforce_dir);

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let make_target = if profile == "release" { "lib" } else { "lib-debug" };

    let status = Command::new("make")
        .arg("clean")
        .current_dir(&rayforce_dir)
        .status()
        .expect("Failed to run make clean");

    if !status.success() {
        panic!("make clean failed");
    }

    let status = Command::new("make")
        .arg(make_target)
        .current_dir(&rayforce_dir)
        .status()
        .expect("Failed to run make lib");

    if !status.success() {
        panic!("Failed to build librayforce.a");
    }

    // Link the static library
    println!("cargo:rustc-link-search=native={}", rayforce_dir.display());
    println!("cargo:rustc-link-lib=static=rayforce");

    // Link system libraries based on platform
    #[cfg(target_os = "linux")]
    {
        println!("cargo:rustc-link-lib=dylib=m");
        println!("cargo:rustc-link-lib=dylib=dl");
        println!("cargo:rustc-link-lib=dylib=pthread");
    }

    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=dylib=m");
        println!("cargo:rustc-link-lib=dylib=dl");
        println!("cargo:rustc-link-lib=dylib=pthread");
    }

    #[cfg(target_os = "windows")]
    {
        println!("cargo:rustc-link-lib=dylib=ws2_32");
        println!("cargo:rustc-link-lib=dylib=mswsock");
        println!("cargo:rustc-link-lib=dylib=kernel32");
    }

    // Run Tauri build
    tauri_build::build();
}
