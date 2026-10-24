package sgcoding.executor.file;

public record ReadFileRequest(
    String filePath,
    int offset,
    int limit
) {
    public boolean hasLegalPath() {
        return filePath != null && !filePath.isBlank();
    }

    public boolean hasLegalOffsetorLimit() {
        return offset >= 0 && limit >= 0;
    }
}

