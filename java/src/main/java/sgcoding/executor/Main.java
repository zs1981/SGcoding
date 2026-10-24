package sgcoding.executor;

import com.google.gson.Gson;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import sgcoding.executor.file.ReadFile;
import sgcoding.executor.file.ReadFileRequest;

public class Main {
    public static void main(String[] args) throws IOException {
        System.err.println("SGCoding Java executor started");

        if (args.length != 1) {
            System.err.println("Pass an absolute file path.");
            System.exit(2);
        }

        var request = new ReadFileRequest(args[0], 1, 5);
        var result = ReadFile.read(request);

        var gson = new Gson();
        String json = gson.toJson(result);

        var output = new OutputStreamWriter(
            System.out,
            StandardCharsets.UTF_8
        );

        output.write(json);
        output.write("\n");
        output.flush();

        System.err.println(result);
    }
}

