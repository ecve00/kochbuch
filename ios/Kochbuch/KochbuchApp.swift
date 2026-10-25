import SwiftUI

// Kochbuch für iPhone und iPad: eine native Hülle um die Web-App aus dem Ordner kochbuch/.
// Die Web-App liegt im App-Bundle unter web/ und spricht direkt mit Supabase.
@main
struct KochbuchApp: App {
    var body: some Scene {
        WindowGroup {
            WebAppView()
                .ignoresSafeArea()
                .background(Color(uiColor: .systemGroupedBackground))
        }
    }
}
