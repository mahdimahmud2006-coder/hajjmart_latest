<?php

namespace App\Services;

use ImageKit\ImageKit;
use App\Models\ImageKitFileId;

class ImageKitService
{
    private ImageKit $imageKit;

    public function __construct()
    {
        $this->imageKit = new ImageKit(
            config('services.imagekit.public_key'),
            config('services.imagekit.private_key'),
            config('services.imagekit.url_endpoint'),
        );
    }

    /**
     * Upload a file to ImageKit and store the fileId against the URL.
     * If the DB insert fails, the file is deleted from ImageKit to prevent orphans.
     *
     * @param  \Illuminate\Http\UploadedFile  $file
     * @param  string  $folder   e.g. 'products', 'categories'
     * @return string            The ImageKit URL of the uploaded file
     *
     * @throws \RuntimeException
     */
    public function upload($file, string $folder): string
    {
        $fileName   = $this->generateUniqueFileName($file->getClientOriginalExtension());
        $mimeType   = $file->getMimeType();
        $base64Data = base64_encode(file_get_contents($file->getRealPath()));
        $fileData   = "data:{$mimeType};base64,{$base64Data}";

        $response = $this->imageKit->uploadFile([
            'file'              => $fileData,
            'fileName'          => $fileName,
            'folder'            => $folder,
            'useUniqueFileName' => false,
        ]);

        $error  = $response->error  ?? null;
        $result = $response->result ?? $response;

        if ($error) {
            throw new \RuntimeException('ImageKit upload failed: ' . json_encode($error));
        }

        if (empty($result->url) || empty($result->fileId)) {
            throw new \RuntimeException(
                'ImageKit upload returned unexpected response: ' . json_encode($response)
            );
        }

        $url    = $result->url;
        $fileId = $result->fileId;

        // If the DB insert fails, delete the uploaded file from ImageKit
        // so we don't end up with orphaned files that can never be deleted.
        try {
            ImageKitFileId::create([
                'url'     => $url,
                'file_id' => $fileId,
            ]);
        } catch (\Throwable $e) {
            $this->imageKit->deleteFile($fileId);
            throw new \RuntimeException(
                'Failed to record ImageKit fileId — upload has been rolled back. DB error: ' . $e->getMessage()
            );
        }

        return $url;
    }

    /**
     * Delete a file from ImageKit by its URL.
     * Looks up the fileId from the database, deletes from ImageKit,
     * then removes the record.
     *
     * @param  string  $url
     * @return void
     *
     * @throws \RuntimeException
     */
    public function delete(string $url): void
    {
        $fileId = ImageKitFileId::getFileIdByUrl($url);

        if (!$fileId) {
            throw new \RuntimeException("No ImageKit fileId found for URL: {$url}");
        }

        $this->imageKit->deleteFile($fileId);

        ImageKitFileId::where('url', $url)->delete();
    }

    /**
     * Generate a unique 7-digit numeric filename with the original extension.
     * e.g. "4829301.jpg"
     */
    private function generateUniqueFileName(string $extension): string
    {
        $digits = random_int(1_000_000, 9_999_999);
        return $extension ? "{$digits}.{$extension}" : (string) $digits;
    }
}