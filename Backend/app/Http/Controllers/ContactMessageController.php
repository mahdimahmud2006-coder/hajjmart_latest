<?php

namespace App\Http\Controllers;

use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\JsonResponse;

class ContactMessageController extends Controller
{
    public function saveMessage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
        ]);

        $contactMessage = ContactMessage::saveMessage($validated);

        return response()->json([
            'message' => 'Message saved successfully',
        ]);
    }

    public function getMessages(): JsonResponse
    {
        $contactMessage = ContactMessage::getMessages();

        return response()->json([
            'message' => 'Messages fetched successfully',
            'data' => $contactMessage,
        ]);
    }

    public function deleteMessage(int $id): JsonResponse
    {
        $contactMessage = ContactMessage::findOrFail($id);
        $contactMessage->delete();

        return response()->json([
            'message' => 'Message deleted successfully',
        ]);
    }
}
