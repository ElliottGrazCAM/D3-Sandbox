// 1. Initialize the Supabase client
// Replace these with your ACTUAL keys from the Supabase Settings > API tab
const SUPABASE_URL = 'https://yxmfcvuotkgmnyuewfyg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4bWZjdnVvdGtnbW55dWV3ZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTk5MjIsImV4cCI6MjA5MjM3NTkyMn0.RAXRy1QJI7Z2L6_lKFRJukJ5QZhCJY98ThH9OfjjuEQ';

// Use a unique name for the client to avoid conflicts with the library
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. The "Security Guard" function
async function checkUser() {
    // Look for an existing session (browser cookie/local storage)
    const { data, error } = await _supabase.auth.getSession();

    if (error || !data.session) {
        console.log("No active session found. Redirecting to landing page.");
        // Kicks them out if they aren't logged in
        // NOTE: Make sure this path is correct based on where your file is!
        window.location.href = '../index.html';
    } else {
        console.log("Access Granted for:", data.session.user.email);
        // You can use 'data.session.user' later to filter your data!
    }
}

// 3. Execute the check
checkUser();