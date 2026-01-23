//! FFI bindings to librayforce.a
//!
//! These bindings provide access to the Rayforce C API for:
//! - Runtime lifecycle (ray_init, ray_clean)
//! - Query evaluation (eval_str)
//! - Object manipulation (drop_obj, clone_obj)
//! - Data access (at_idx, at_sym)
//! - Serialization (ser_obj, de_obj)

use std::ffi::{c_char, c_void};
use std::ptr;

// =============================================================================
// Type Constants
// =============================================================================

pub const TYPE_LIST: i8 = 0;
pub const TYPE_B8: i8 = 1;
pub const TYPE_U8: i8 = 2;
pub const TYPE_I16: i8 = 3;
pub const TYPE_I32: i8 = 4;
pub const TYPE_I64: i8 = 5;
pub const TYPE_SYMBOL: i8 = 6;
pub const TYPE_DATE: i8 = 7;
pub const TYPE_TIME: i8 = 8;
pub const TYPE_TIMESTAMP: i8 = 9;
pub const TYPE_F64: i8 = 10;
pub const TYPE_GUID: i8 = 11;
pub const TYPE_C8: i8 = 12;
pub const TYPE_TABLE: i8 = 98;
pub const TYPE_DICT: i8 = 99;
pub const TYPE_LAMBDA: i8 = 100;
pub const TYPE_NULL: i8 = 126;
pub const TYPE_ERR: i8 = 127;

// =============================================================================
// Object Structure
// =============================================================================

/// Rayforce object structure (opaque)
/// Memory layout matches C struct obj_t
#[repr(C)]
pub struct ObjT {
    pub mmod: u8,   // memory model
    pub order: u8,  // block order in heap
    pub type_: i8,  // type
    pub attrs: u8,  // attributes
    pub rc: u32,    // reference count
    // Union data follows - access via functions
    _data: [u8; 16], // Union placeholder (i64 len + flexible array member)
}

/// Pointer to Rayforce object
pub type ObjP = *mut ObjT;

/// Null object pointer
pub const NULL_OBJ: ObjP = ptr::null_mut();

// =============================================================================
// Runtime Structure (for poll access)
// =============================================================================

/// Opaque runtime structure
#[repr(C)]
pub struct RuntimeT {
    _opaque: [u8; 0],
}

pub type RuntimeP = *mut RuntimeT;

/// Opaque poll structure
#[repr(C)]
pub struct PollT {
    _opaque: [u8; 0],
}

pub type PollP = *mut PollT;

/// Selector types
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectorType {
    Stdin = 0,
    Stdout = 1,
    Stderr = 2,
    Socket = 3,
    File = 4,
}

/// Poll events
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct PollEvents(pub i32);

impl PollEvents {
    pub const READ: Self = Self(1);
    pub const WRITE: Self = Self(4);
    pub const ERROR: Self = Self(8);
}

/// Opaque selector structure
#[repr(C)]
pub struct SelectorT {
    _opaque: [u8; 0],
}

pub type SelectorP = *mut SelectorT;

/// Option type for poll callbacks
#[repr(C)]
pub struct OptionT {
    pub ok: i8,
    pub value: i64,
}

/// Poll callback function types
pub type PollEvtsFn = Option<unsafe extern "C" fn(PollP, SelectorP)>;
pub type PollDataFn = Option<unsafe extern "C" fn(PollP, SelectorP, *mut c_void) -> OptionT>;
pub type PollIoFn = Option<unsafe extern "C" fn(i64, *mut u8, i64) -> i64>;
pub type PollRdwrFn = Option<unsafe extern "C" fn(PollP, SelectorP) -> OptionT>;

/// Poll registry structure for registering new file descriptors
#[repr(C)]
pub struct PollRegistry {
    pub fd: i64,
    pub type_: SelectorType,
    pub events: PollEvents,
    pub open_fn: PollEvtsFn,
    pub close_fn: PollEvtsFn,
    pub error_fn: PollEvtsFn,
    pub recv_fn: PollIoFn,
    pub send_fn: PollIoFn,
    pub read_fn: PollRdwrFn,
    pub write_fn: PollRdwrFn,
    pub data_fn: PollDataFn,
    pub data: *mut c_void,
}

impl Default for PollRegistry {
    fn default() -> Self {
        Self {
            fd: -1,
            type_: SelectorType::Socket,
            events: PollEvents::READ,
            open_fn: None,
            close_fn: None,
            error_fn: None,
            recv_fn: None,
            send_fn: None,
            read_fn: None,
            write_fn: None,
            data_fn: None,
            data: ptr::null_mut(),
        }
    }
}

// =============================================================================
// FFI Declarations
// =============================================================================

#[link(name = "rayforce")]
extern "C" {
    // =========================================================================
    // Lifecycle
    // =========================================================================

    /// Initialize Rayforce runtime
    /// Returns 0 on success
    pub fn ray_init() -> i32;

    /// Clean up Rayforce runtime
    pub fn ray_clean();

    // =========================================================================
    // Evaluation
    // =========================================================================

    /// Evaluate a string as Rayfall code
    /// Returns result object (caller must drop_obj when done)
    pub fn eval_str(code: *const c_char) -> ObjP;

    /// Evaluate an object (parsed AST)
    /// Takes ownership of obj
    pub fn eval_obj(obj: ObjP) -> ObjP;

    /// Parse a string into an AST object
    pub fn parse_str(code: *const c_char) -> ObjP;

    // =========================================================================
    // Memory Management
    // =========================================================================

    /// Free an object
    /// IMPORTANT: Must be called on the Rayforce thread!
    pub fn drop_obj(obj: ObjP);

    /// Clone an object (increment refcount)
    pub fn clone_obj(obj: ObjP) -> ObjP;

    /// Copy an object (deep copy)
    pub fn copy_obj(obj: ObjP) -> ObjP;

    /// Get reference count
    pub fn rc_obj(obj: ObjP) -> u32;

    // =========================================================================
    // Type Checking
    // =========================================================================

    /// Check if object is null
    pub fn is_null(obj: ObjP) -> i8;

    /// Get type name string
    pub fn type_name(tp: i8) -> *const c_char;

    // =========================================================================
    // Data Access
    // =========================================================================

    /// Get element at index (for vectors/lists/tables)
    pub fn at_idx(obj: ObjP, idx: i64) -> ObjP;

    /// Get element by symbol name (for dicts/tables)
    pub fn at_sym(obj: ObjP, sym: *const c_char, len: i64) -> ObjP;

    /// Get element by object index
    pub fn at_obj(obj: ObjP, idx: ObjP) -> ObjP;

    /// Get keys from dict/table
    pub fn ray_key(obj: ObjP) -> ObjP;

    /// Get values from dict/table
    pub fn ray_value(obj: ObjP) -> ObjP;

    /// Get count/length of object
    pub fn ray_count(obj: ObjP) -> i64;

    // =========================================================================
    // Constructors
    // =========================================================================

    /// Create null atom of type
    pub fn null(type_: i8) -> ObjP;

    /// Create vector of type with length
    pub fn vector(type_: i8, len: i64) -> ObjP;

    /// Create symbol from string
    pub fn symbol(ptr: *const c_char, len: i64) -> ObjP;

    /// Create i64 atom
    pub fn i64_(val: i64) -> ObjP;

    /// Create f64 atom
    pub fn f64_(val: f64) -> ObjP;

    /// Create table from keys and values
    pub fn table(keys: ObjP, vals: ObjP) -> ObjP;

    /// Create dict from keys and values
    pub fn dict(keys: ObjP, vals: ObjP) -> ObjP;

    // =========================================================================
    // Serialization
    // =========================================================================

    /// Serialize object to byte vector
    pub fn ser_obj(obj: ObjP) -> ObjP;

    /// Deserialize byte vector to object
    pub fn de_obj(buf: ObjP) -> ObjP;

    /// Get serialized size of object
    pub fn size_obj(obj: ObjP) -> i64;

    // =========================================================================
    // Runtime Access
    // =========================================================================

    /// Get the global runtime pointer
    pub fn runtime_get() -> RuntimeP;

    // =========================================================================
    // Poll System
    // =========================================================================

    /// Create a new poll instance
    pub fn poll_create() -> PollP;

    /// Destroy a poll instance
    pub fn poll_destroy(poll: PollP);

    /// Register a file descriptor with the poll
    #[cfg(not(target_os = "windows"))]
    pub fn poll_register(poll: PollP, registry: *mut PollRegistry) -> i64;

    /// Deregister a selector from the poll
    pub fn poll_deregister(poll: PollP, id: i64);

    /// Run the poll event loop (blocks)
    pub fn poll_run(poll: PollP) -> i64;

    /// Exit the poll event loop
    pub fn poll_exit(poll: PollP, code: i64);

    /// Get selector by ID
    pub fn poll_get_selector(poll: PollP, id: i64) -> SelectorP;

    // =========================================================================
    // Error Handling
    // =========================================================================

    /// Create an error object with message
    pub fn ray_err(msg: *const c_char) -> ObjP;
}

// =============================================================================
// Safe Wrappers
// =============================================================================

impl ObjT {
    /// Check if this is an error object
    #[inline]
    pub fn is_error(&self) -> bool {
        self.type_ == TYPE_ERR
    }

    /// Check if this is a table
    #[inline]
    pub fn is_table(&self) -> bool {
        self.type_ == TYPE_TABLE
    }

    /// Check if this is a dict
    #[inline]
    pub fn is_dict(&self) -> bool {
        self.type_ == TYPE_DICT
    }

    /// Check if this is an atom (negative type)
    #[inline]
    pub fn is_atom(&self) -> bool {
        self.type_ < 0
    }

    /// Check if this is a vector
    #[inline]
    pub fn is_vector(&self) -> bool {
        self.type_ >= 0 && self.type_ <= TYPE_C8
    }

    /// Check if this is a list (type 0)
    #[inline]
    pub fn is_list(&self) -> bool {
        self.type_ == TYPE_LIST
    }

    /// Get the length of a vector/list/table
    /// Safety: Only valid for vectors/lists/tables
    #[inline]
    pub unsafe fn len(&self) -> i64 {
        // Length is stored at offset 8 in the union
        let ptr = (self as *const ObjT as *const u8).add(8) as *const i64;
        *ptr
    }

    /// Get i64 value from scalar
    /// Safety: Only valid for I64 atoms (type -5)
    #[inline]
    pub unsafe fn as_i64(&self) -> i64 {
        let ptr = (self as *const ObjT as *const u8).add(8) as *const i64;
        *ptr
    }

    /// Get f64 value from scalar
    /// Safety: Only valid for F64 atoms (type -10)
    #[inline]
    pub unsafe fn as_f64(&self) -> f64 {
        let ptr = (self as *const ObjT as *const u8).add(8) as *const f64;
        *ptr
    }

    /// Get pointer to vector data
    /// Safety: Only valid for vectors
    #[inline]
    pub unsafe fn data_ptr<T>(&self) -> *const T {
        // Data pointer is at offset 16 (after len at offset 8)
        let ptr = (self as *const ObjT as *const u8).add(16) as *const *const T;
        *ptr
    }
}

/// Safe wrapper for evaluating code
pub fn safe_eval_str(code: &str) -> ObjP {
    let c_code = std::ffi::CString::new(code).expect("CString::new failed");
    unsafe { eval_str(c_code.as_ptr()) }
}

/// Check if an object pointer is valid (not null and not error)
pub fn is_valid_result(obj: ObjP) -> bool {
    if obj.is_null() {
        return false;
    }
    unsafe {
        if is_null(obj) != 0 {
            return false;
        }
        !(*obj).is_error()
    }
}
