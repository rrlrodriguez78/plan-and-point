import { Button } from "@/components/ui/button";
import { Facebook, Twitter, Linkedin, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface SocialShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export default function SocialShareButtons({ url, title, description = "" }: SocialShareButtonsProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank', 'width=600,height=400');
    toast.success(`Compartiendo en ${platform}`);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Compartir en redes sociales</p>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('facebook')}
          className="flex-1"
        >
          <Facebook className="h-4 w-4 mr-2" />
          Facebook
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('twitter')}
          className="flex-1"
        >
          <Twitter className="h-4 w-4 mr-2" />
          Twitter
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('linkedin')}
          className="flex-1"
        >
          <Linkedin className="h-4 w-4 mr-2" />
          LinkedIn
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('whatsapp')}
          className="flex-1"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('email')}
          className="flex-1"
        >
          <Mail className="h-4 w-4 mr-2" />
          Email
        </Button>
      </div>
    </div>
  );
}