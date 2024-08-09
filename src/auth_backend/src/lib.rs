use candid::{CandidType, Deserialize, Principal};
use ic_cdk::*;
use serde::__private::Vec;
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(CandidType, Deserialize, Clone)]
struct Image {
    id: u64,
    name: String,
    creator: Principal,
    data: Vec<u8>,
}

#[derive(CandidType, Deserialize, Default)]
struct State {
    images: HashMap<u64, Image>,
    user_names: HashMap<Principal, String>,
    next_image_id: u64,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::default();
}

#[update]
fn set_name(name: String) {
    let caller = ic_cdk::caller();
    STATE.with(|state| {
        state.borrow_mut().user_names.insert(caller, name);
    })
}

#[update]
fn upload_image(name: String, data: Vec<u8>) -> u64 {
    let caller = ic_cdk::api::caller();
    ic_cdk::api::caller();
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        let id = state.next_image_id;
        state.next_image_id += 1;
        let image = Image {
            id,
            name,
            creator: caller,
            data,
        };
        state.images.insert(id, image);
        id
    })
}

#[derive(CandidType, Deserialize)]
enum DeleteResult {
    Success,
    NotFound,
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Clone)]
struct CallerInfo {
    principal: String,
}

#[update]
fn delete_image(id: u64) -> DeleteResult {
    let caller = ic_cdk::api::caller();
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        if let Some(image) = state.images.get(&id) {
            if image.creator == caller {
                state.images.remove(&id);
                state.next_image_id -= 1;
                DeleteResult::Success
            } else {
                DeleteResult::NotAuthorized
            }
        } else {
            DeleteResult::NotFound
        }
    })
}

#[ic_cdk::query]
fn whoami() -> Principal {
    let caller = ic_cdk::api::caller();
    // if caller == Principal::anonymous() {
    //     panic!("Anonymous principal not allowed to make calls.")
    // }
    caller
}

#[ic_cdk::query]
fn get_all_images(limit: Option<usize>) -> Vec<(u64, String, String, Vec<u8>)> {
    ic_cdk::println!("get_all_images called with limit: {:?}", limit);
    STATE.with(|state| {
        let state = state.borrow();
        let result: Vec<_> = state
            .images
            .iter()
            .take(limit.unwrap_or(usize::MAX))
            .map(|(id, image)| {
                let creator_name = state
                    .user_names
                    .get(&image.creator)
                    .cloned()
                    .unwrap_or_else(|| "Unknown".to_string());
                ic_cdk::println!(
                    "Processing image: id={}, name={}, creator={}",
                    id,
                    image.name,
                    creator_name
                );
                (*id, image.name.clone(), creator_name, image.data.clone())
            })
            .collect();
        ic_cdk::println!("Returning {} images", result.len());
        result
    })
}

#[query]
fn get_image(id: u64) -> Option<Vec<u8>> {
    STATE.with(|state| state.borrow().images.get(&id).map(|img| img.data.clone()))
}

// Enable Candid export
ic_cdk::export_candid!();
