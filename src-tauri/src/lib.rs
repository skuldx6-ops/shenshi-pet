use tauri::{
    Emitter, Manager,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ))?;
            let show = MenuItem::with_id(app, "show", "显示桌宠", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "默认提醒", true, None::<&str>)?;
            let custom = MenuItem::with_id(app, "custom", "自定义提醒", true, None::<&str>)?;
            let focus = MenuItem::with_id(app, "focus", "切换专注模式", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出申时桌宠", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &settings, &custom, &focus, &quit])?;

            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            let tray = TrayIconBuilder::new().menu(&menu).icon(tray_icon);
            tray.on_menu_event(|app, event| match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("pet") {
                        let _ = window.show();
                    }
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("default-settings") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "custom" => {
                    if let Some(window) = app.get_webview_window("custom-settings") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = app.emit("edit-custom-reminder", "");
                    }
                }
                "focus" => {
                    let _ = app.emit("tray-toggle-focus", ());
                }
                "quit" => app.exit(0),
                _ => {}
            })
            .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if matches!(window.label(), "default-settings" | "custom-settings" | "menu" | "pet") {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Shenshi Pet");
}
