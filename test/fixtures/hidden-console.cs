using System;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

// A real Windows console executable: the test fails if the query allocates a console.
public class ConsoleProbe
{
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();

    public static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            Match id = Regex.Match(line, "\"id\"\\s*:\\s*(\\d+)");
            if (!id.Success) continue;
            string response;
            if (GetConsoleWindow() != IntPtr.Zero)
                response = "\"error\":{\"code\":-32603,\"message\":\"A console window was allocated\"}";
            else if (line.Contains("initialize"))
                response = "\"result\":{}";
            else
                response = "\"result\":{\"account\":null,\"requiresOpenaiAuth\":true}";
            Console.WriteLine("{\"id\":" + id.Groups[1].Value + "," + response + "}");
            Console.Out.Flush();
        }
    }
}
