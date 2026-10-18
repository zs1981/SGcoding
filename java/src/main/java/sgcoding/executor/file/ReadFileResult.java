package sgcoding.executor.file;

public record ReadFileResult(
    String path,
    String text,
    int lineStart,
    int lineEnd,
    int totalLines,
    boolean truncated
) {}