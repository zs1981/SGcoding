package sgcoding.executor.file;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;

public final class ReadFile {
    private static final int MAX_LINE_LENGTH = 2000;
    private static final int MAX_BYTES = 50 * 1024;

    private ReadFile() {
    }

    public static ReadFileResult read(ReadFileRequest request) throws IOException {
        if (!request.hasLegalPath()) {
            throw new IllegalArgumentException("filePath must not be blank");
        }

        if (!request.hasLegalOffsetorLimit()) {
            throw new IllegalArgumentException("offset and limit must not be negative");
        }

        int offset = Math.max(1,request.offset());
        Path path = Path.of(request.filePath()).normalize();
        if (!path.isAbsolute()) {
            throw new IllegalArgumentException("filepath must be absolute");
        }

        var attribute = Files.readAttributes(path, BasicFileAttributes.class);
        if (!attribute.isRegularFile()) {
            throw new IOException("Not a regular file " + path);
        }

        var lines = new ArrayList<String>();
        int count = 0;
        int bytes = 0;
        boolean truncated = false;

        try (var reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                count++;

                if (truncated) { continue; }

                if (count < offset) { continue; }

                if (lines.size() >= request.limit()) {
                    truncated = true;
                    continue;
                }

                String text = line.length() > MAX_LINE_LENGTH
                    ? line.substring(0, MAX_LINE_LENGTH)
                        + "...(line truncated to 2000 chars)"
                    : line;
                
                int size = 
                    text.getBytes(StandardCharsets.UTF_8).length
                    + (lines.isEmpty()? 0 : 1);
                
                if (bytes + size > MAX_BYTES) {
                    truncated = true;
                    continue;
                }

                lines.add(text);
                bytes += size;
            }
        }

        if (count < offset && !(count == 0 && offset == 1)) {
            throw new IOException("Offset " + offset
                    + " is out of range (" + count + " lines)");
        }

        return new ReadFileResult(
            path.toString(),
            String.join("\n", lines),
            offset,
            offset + lines.size() - 1,
            count,
            truncated
        ); 
    }
}
